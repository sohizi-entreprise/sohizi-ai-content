local inflightKey = KEYS[1]
local holderKey = KEYS[2]
local circuitKey = KEYS[3]

local leaseId = ARGV[1]
local epoch = tonumber(ARGV[2])
local leaseTtlMs = tonumber(ARGV[3])
local probeTtlMs = tonumber(ARGV[4])
local inflightKeyTtlMs = tonumber(ARGV[5])

local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

local holder = redis.call("HMGET", holderKey, "leaseId", "epoch")
local currentLease = holder[1]
local currentEpoch = tonumber(holder[2] or "")
if not currentLease or currentLease == "" then
    return {0, "not_found", 0}
end
if currentLease ~= leaseId or currentEpoch ~= epoch then
    return {0, "stale_lease", 0}
end

local score = redis.call("ZSCORE", inflightKey, leaseId)
if not score or tonumber(score) <= now then
    return {0, "not_found", 0}
end

local expiresAt = now + leaseTtlMs
redis.call("ZADD", inflightKey, expiresAt, leaseId)
redis.call("HSET", holderKey, "expiresAt", tostring(expiresAt))
redis.call("PEXPIRE", holderKey, leaseTtlMs)
if inflightKeyTtlMs > 0 then
    redis.call("PEXPIRE", inflightKey, inflightKeyTtlMs)
end

local st = redis.call("HMGET", circuitKey, "state", "probe_id")
if st[1] == "half_open" and st[2] == leaseId then
    redis.call("PEXPIRE", circuitKey, math.max(probeTtlMs, leaseTtlMs))
end

return {1, "ok", expiresAt}
