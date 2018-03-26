const bluebird = require('./bluebird')
const http = require('./http')
const ioredis = require('./ioredis')
const koaRouter = require('./koa-router')
const mongodb = require('./mongodb')
const sequelize = require('./sequelize')

module.exports = {
  'bluebird': bluebird,
  'http': http,
  'ioredis': ioredis,
  'koa-router': koaRouter,
  'mongodb': mongodb,
  'sequelize': sequelize
}
