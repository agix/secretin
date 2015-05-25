var redis = require('redis');
client = redis.createClient();
client.setex("abcde", 10, "test2");