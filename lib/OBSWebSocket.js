require('./util/callbackPromise')(Promise);
const Socket = require('./Socket');
const Status = require('./Status');
const debug = require('debug')('obs-websocket-js:Core');

let requestCounter = 0;

function generateMessageId() {
  return String(requestCounter++);
}

class OBSWebSocket extends Socket {
  /**
   * Internal generic Socket request method. Returns a promise, handles callbacks.
   * Generates a messageId internally and will override any passed in the args.
   * Note that the requestType here is pre-marshaling and currently must match exactly what the websocket plugin is expecting.
   *
   * @param  {String}   requestType obs-websocket plugin expected request type.
   * @param  {Object}   [args={}]   request arguments.
   * @param  {Function} callback    Optional. callback(err, data)
   * @return {Promise}              Promise, passes the plugin response object.
   */
  send(requestType, args = {}, callback) {
    args = args || {};

    return new Promise((resolve, reject) => {
      const messageId = generateMessageId();
      let rejectReason;

      if (!requestType) {
        rejectReason = Status.REQUEST_TYPE_NOT_SPECIFIED;
      }

      if (!this._connected) {
        rejectReason = Status.NOT_CONNECTED;
      }

      // Assign a temporary event listener for this particular messageId to uniquely identify the response.
      this.once(`obs:internal:message:id-${messageId}`, (err, data) => {
        if (err) {
          debug('[send:reject] %o', err);
          reject(err);
        } else {
          debug('[send:resolve] %o', data);
          resolve(data);
        }
      });

      // If we don't have a reason to fail fast, send the request to the socket.
      if (!rejectReason) {
        args['request-type'] = requestType;
        args['message-id'] = messageId;

        // Submit the request to the websocket.
        debug('[send] %s %s %o', messageId, requestType, args);
        try {
          this._socket.send(JSON.stringify(args));
        } catch (e) {
          // TODO: Consider inspecting the exception thrown to gleam some relevant info and pass that on.
          rejectReason = Status.SOCKET_EXCEPTION;
        }
      }

      // If the socket call was unsuccessful or bypassed, simulate its resolution.
      if (rejectReason) {
        this.emit(`obs:internal:message:id-${messageId}`, rejectReason);
      }
    }).callback(callback);
  }
}

module.exports = OBSWebSocket;
