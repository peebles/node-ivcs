"use strict";

let jwt = require( 'njwt' );

let utils = {};

utils.create = function( data, exp, tokenSigningKey ) {
  let token = jwt.create({ sub: data }, tokenSigningKey );
  if ( exp > 0 )
    token.setExpiration( new Date().getTime() + ( exp * 1000 ) ); // exp is in seconds
  return token.compact();
}

utils.verify = function( token, tokenSigningKey ) {
  try {
    var verified = jwt.verify( token, tokenSigningKey );
    return verified.body.sub;
  } catch( err ) {
    return null;
  }
}

module.exports = utils;
