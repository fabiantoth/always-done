/*!
 * always-done <https://github.com/tunnckoCore/always-done>
 *
 * Copyright (c) 2015 Charlike Mike Reagent <@tunnckoCore> (http://www.tunnckocore.tk)
 * Released under the MIT license.
 */

'use strict'

var sliced = require('sliced')
var onetime = require('onetime')
var dezalgo = require('dezalgo')
var Bluebird = require('bluebird')
var isError = require('is-typeof-error')
var isAsyncFn = require('is-async-function')
var isNodeStream = require('is-node-stream')
var isChildProcess = require('is-child-process')
var streamExhaust = require('stream-exhaust')
var onStreamEnd = require('on-stream-end')

module.exports = function alwaysDone (fn) {
  var self = this
  var argz = sliced(arguments)
  var args = sliced(argz, 1, -1)
  var callback = argz[argz.length - 1]

  if (typeof callback !== 'function') {
    throw new TypeError('always-done: expect `callback` function as last argument')
  }
  var done = onetime(dezalgo(function (err) {
    if (err instanceof Error) {
      callback.call(self, err)
      return
    }
    callback.apply(self, [null].concat(sliced(arguments, 1)))
  }))

  process.once('uncaughtException', done)
  process.on('newListener', function (name) {
    this.removeAllListeners(name)
  })

  if (isAsyncFn(fn)) args = args.concat(done)

  return Bluebird.resolve()
    .then(function () {
      return fn.apply(self, args)
    })
    .then(function (ret) {
      if (isNodeStream(ret) || isChildProcess(ret)) {
        onStreamEnd(streamExhaust(ret), done)
        return
      }
      if (ret && typeof ret.subscribe === 'function') {
        if (ret.value) return done(null, ret.value)
        ret.subscribe(function noop () {}, done, done)
        return
      }
      if (isError(ret)) {
        done(ret)
        return
      }
      done.call(self, null, ret)
    }, done)
}
