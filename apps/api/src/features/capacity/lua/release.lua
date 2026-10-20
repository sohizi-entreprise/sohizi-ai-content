local inflightKey = KEYS[1]
local holderKey = KEYS[2]
local tbKey = KEYS[3]
local circuitKey = KEYS[4]

local leaseId = ARGV[1]
local epoch = tonumber(ARGV[2])
local outcome = ARGV[3]
local retryAfterMs = tonumber(ARGV[4]) or 0
local cooldownMs = tonumber(ARGV[5]) or 0
local burst = tonumber(ARGV[6]) or 0

local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

local holder = redis.call("HMGET", holderKey, "leaseId", "epoch", "spent")
local currentLease = holder[1]
local currentEpoch = tonumber(holder[2] or "")
if not currentLease or currentLease == "" then
    return {0, "not_found"}
end
if currentLease ~= leaseId or currentEpoch ~= epoch then
    return {0, "stale_lease"}
end

local spent = holder[3] == "1"
redis.call("ZREM", inflightKey, leaseId)
redis.call("DEL", holderKey)

local st = redis.call("HMGET", circuitKey, "state", "probe_id")
local isProbe = st[1] == "half_open" and st[2] == leaseId

if outcome == "not_sent" and spent and burst > 0 then
    local tb = redis.call("HMGET", tbKey, "tokens", "ts")
    local tokens = tonumber(tb[1])
    if tokens == nil then
        tokens = 0
    end
    tokens = math.min(burst, tokens + 1)
    redis.call("HSET", tbKey, "tokens", tostring(tokens), "ts", tostring(now))
end

if outcome == "completed" then
    if isProbe then
        redis.call("DEL", circuitKey)
    end
    return {1, "ok"}
end

if outcome == "rate_limited" then
    local wait = retryAfterMs
    if wait <= 0 then
        wait = cooldownMs
    end
    if wait <= 0 then
        wait = 15000
    end
    redis.call(
        "HSET",
        circuitKey,
        "state",
        "open",
        "open_until",
        tostring(now + wait),
        "probe_id",
        ""
    )
    redis.call("PEXPIRE", circuitKey, wait + 1000)
    return {1, "ok"}
end

if outcome == "not_sent" or outcome == "abandoned" then
    if isProbe then
        local wait = math.max(cooldownMs, 5000)
        redis.call(
            "HSET",
            circuitKey,
            "state",
            "open",
            "open_until",
            tostring(now + wait),
            "probe_id",
            ""
        )
        redis.call("PEXPIRE", circuitKey, wait + 1000)
    end
    return {1, "ok"}
end

return {0, "not_found"}
