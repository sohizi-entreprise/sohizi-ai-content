local inflightKey = KEYS[1]
local circuitKey = KEYS[2]

local requestId = ARGV[1]
local outcome = ARGV[2]
local retryAfterMs = tonumber(ARGV[3])
local cooldownMs = tonumber(ARGV[4])

local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

local st = redis.call("HMGET", circuitKey, "state", "probe_id")
local state = st[1]
local probeId = st[2]
local isProbe = state == "half_open" and probeId == requestId

if outcome == "submit_ok" then
    if isProbe then
        redis.call("DEL", circuitKey)
    end
    return 1
end

redis.call("ZREM", inflightKey, requestId)

if outcome == "success" then
    if isProbe then
        redis.call("DEL", circuitKey)
    end
    return 1
end

if outcome == "failure" then
    local wait = math.max(retryAfterMs or 0, cooldownMs or 0)
    if wait <= 0 then
        wait = 15000
    end
    redis.call("HSET", circuitKey, "state", "open", "open_until", tostring(now + wait), "probe_id", "")
    redis.call("PEXPIRE", circuitKey, wait + 1000)
    return 1
end

-- outcome == "none": drop the slot only
if isProbe then
    local wait = math.max(cooldownMs or 0, 5000)
    redis.call("HSET", circuitKey, "state", "open", "open_until", tostring(now + wait), "probe_id", "")
    redis.call("PEXPIRE", circuitKey, wait + 1000)
end

return 1
