"use strict";

let app = {};
app.ivcs = {
  Auth: require( './lib/Auth' )( app ),
  OAuth: require( './lib/OAuth' )( app ),
};

module.exports = {
  Auth: app.ivcs.Auth,
  OAuth: app.ivcs.OAuth,
};
