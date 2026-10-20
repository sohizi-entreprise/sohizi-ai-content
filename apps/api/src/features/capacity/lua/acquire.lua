local inflightKey = KEYS[1]
local holderKey = KEYS[2]
local tbKey = KEYS[3]
local circuitKey = KEYS[4]
local epochKey = KEYS[5]

local newLeaseId = ARGV[1]
local maxConcurrency = tonumber(ARGV[2])
local rpm = tonumber(ARGV[3])
local burst = tonumber(ARGV[4])
local leaseTtlMs = tonumber(ARGV[5])
local probeTtlMs = tonumber(ARGV[6])
local inflightKeyTtlMs = tonumber(ARGV[7])

local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

local holder = redis.call("HMGET", holderKey, "leaseId", "epoch", "spent")
local existingLease = holder[1]

if existingLease and existingLease ~= "" then
    local score = redis.call("ZSCORE", inflightKey, existingLease)
    if score and tonumber(score) > now then
        local expiresAt = now + leaseTtlMs
        local existingEpoch = tonumber(holder[2] or "0") or 0
        redis.call("ZADD", inflightKey, expiresAt, existingLease)
        redis.call("HSET", holderKey, "expiresAt", tostring(expiresAt))
        redis.call("PEXPIRE", holderKey, leaseTtlMs)
        if inflightKeyTtlMs > 0 then
            redis.call("PEXPIRE", inflightKey, inflightKeyTtlMs)
        end
        local st = redis.call("HMGET", circuitKey, "state", "probe_id")
        if st[1] == "half_open" and st[2] == existingLease then
            redis.call("PEXPIRE", circuitKey, math.max(probeTtlMs, leaseTtlMs))
        end
        return {1, "ok", existingLease, existingEpoch, expiresAt, 1}
    end
end

local st = redis.call("HMGET", circuitKey, "state", "open_until", "probe_id")
local state = st[1]
local openUntil = tonumber(st[2] or "0") or 0
local becomeProbe = false

if state == "open" then
    if now < openUntil then
        return {0, "circuit_open", "", 0, 0, 0, math.max(openUntil - now, 0)}
    end
    becomeProbe = true
elseif state == "half_open" then
    local ttl = redis.call("PTTL", circuitKey)
    if ttl < 0 then
        ttl = 0
    end
    return {0, "circuit_open", "", 0, 0, 0, ttl}
end

redis.call("ZREMRANGEBYSCORE", inflightKey, "-inf", now)
local inflight = redis.call("ZCARD", inflightKey)
if inflight >= maxConcurrency then
    local oldest = redis.call("ZRANGE", inflightKey, 0, 0, "WITHSCORES")
    local retryAfter = 0
    if oldest[2] then
        retryAfter = math.max(tonumber(oldest[2]) - now, 0)
    end
    return {0, "concurrency", "", 0, 0, 0, retryAfter}
end

local spent = 0
if rpm > 0 then
    local bucketBurst = burst
    if bucketBurst <= 0 then
        bucketBurst = rpm
    end
    local tb = redis.call("HMGET", tbKey, "tokens", "ts")
    local tokens = tonumber(tb[1])
    local ts = tonumber(tb[2])
    if tokens == nil then
        tokens = bucketBurst
        ts = now
    else
        local elapsed = math.max(now - ts, 0)
        tokens = math.min(bucketBurst, tokens + (elapsed * rpm / 60000))
        ts = now
    end
    if tokens < 1 then
        local retryAfter = math.ceil((1 - tokens) * 60000 / rpm)
        redis.call("HSET", tbKey, "tokens", tostring(tokens), "ts", tostring(ts))
        return {0, "rpm", "", 0, 0, 0, retryAfter}
    end
    tokens = tokens - 1
    redis.call("HSET", tbKey, "tokens", tostring(tokens), "ts", tostring(ts))
    spent = 1
end

local epoch = redis.call("INCR", epochKey)
local expiresAt = now + leaseTtlMs
if becomeProbe then
    redis.call(
        "HSET",
        circuitKey,
        "state",
        "half_open",
        "probe_id",
        newLeaseId,
        "open_until",
        "0"
    )
    redis.call("PEXPIRE", circuitKey, probeTtlMs)
end

redis.call("ZADD", inflightKey, expiresAt, newLeaseId)
if inflightKeyTtlMs > 0 then
    redis.call("PEXPIRE", inflightKey, inflightKeyTtlMs)
end
redis.call(
    "HSET",
    holderKey,
    "leaseId",
    newLeaseId,
    "epoch",
    tostring(epoch),
    "expiresAt",
    tostring(expiresAt),
    "spent",
    tostring(spent)
)
redis.call("PEXPIRE", holderKey, leaseTtlMs)

return {1, "ok", newLeaseId, epoch, expiresAt, 0}
