local inflightKey = KEYS[1]
local tbKey = KEYS[2]
local circuitKey = KEYS[3]

local requestId = ARGV[1]
local maxConcurrency = tonumber(ARGV[2])
local rpm = tonumber(ARGV[3])
local burst = tonumber(ARGV[4])
local leaseTtlMs = tonumber(ARGV[5])
local probeTtlMs = tonumber(ARGV[6])
local inflightKeyTtlMs = tonumber(ARGV[7])

local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

if redis.call("ZSCORE", inflightKey, requestId) then
    redis.call("ZADD", inflightKey, now + leaseTtlMs, requestId)
    if inflightKeyTtlMs > 0 then
        redis.call("PEXPIRE", inflightKey, inflightKeyTtlMs)
    end
    return {1, "ok", 0}
end

local st = redis.call("HMGET", circuitKey, "state", "open_until", "probe_id")
local state = st[1]
local openUntil = tonumber(st[2] or "0")
local probeId = st[3]
local becomeProbe = false

if state == "open" then
    if now < openUntil then
        return {0, "circuit_open", math.max(openUntil - now, 0)}
    end
    becomeProbe = true
elseif state == "half_open" then
    if probeId ~= requestId then
        local ttl = redis.call("PTTL", circuitKey)
        if ttl < 0 then
            ttl = 0
        end
        return {0, "circuit_open", ttl}
    end
end

redis.call("ZREMRANGEBYSCORE", inflightKey, "-inf", now)
local inflight = redis.call("ZCARD", inflightKey)

if inflight >= maxConcurrency then
    local oldest = redis.call("ZRANGE", inflightKey, 0, 0, "WITHSCORES")
    local retryAfter = 0
    if oldest[2] then
        retryAfter = math.max(tonumber(oldest[2]) - now, 0)
    end
    return {0, "concurrency", retryAfter}
end

local tb = redis.call("HMGET", tbKey, "tokens", "ts")
local tokens = tonumber(tb[1])
local ts = tonumber(tb[2])

if tokens == nil then
    tokens = burst
    ts = now
else
    local elapsed = math.max(now - ts, 0)
    tokens = math.min(burst, tokens + (elapsed * rpm / 60000))
    ts = now
end

if tokens < 1 then
    local retryAfter = 0
    if rpm > 0 then
        retryAfter = math.ceil((1 - tokens) * 60000 / rpm)
    end
    redis.call("HSET", tbKey, "tokens", tostring(tokens), "ts", tostring(ts))
    return {0, "rpm", retryAfter}
end

tokens = tokens - 1
redis.call("HSET", tbKey, "tokens", tostring(tokens), "ts", tostring(ts))

if becomeProbe then
    redis.call("HSET", circuitKey, "state", "half_open", "probe_id", requestId, "open_until", "0")
    redis.call("PEXPIRE", circuitKey, probeTtlMs)
end

redis.call("ZADD", inflightKey, now + leaseTtlMs, requestId)
if inflightKeyTtlMs > 0 then
    redis.call("PEXPIRE", inflightKey, inflightKeyTtlMs)
end

return {1, "ok", 0}
