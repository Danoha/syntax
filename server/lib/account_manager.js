/* 
 * Copyright (C) 2014 Danoha
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

'use strict';

var MySQL = require('mysql');

//

var AccManager = function(credentials) {
  this.connection = MySQL.createConnection(credentials);
};

AccManager.prototype.onError = function(err) {
  console.error("mysql error", err);
};

/**
 * @param {Function} callback
 */
AccManager.prototype.connect = function(callback) {
  process.stdout.write('connecting to database... ');
  
  this.connection.query('SET NAMES UTF8', function(err) {
    if(err) {
      console.error("FAILED", err);
      return;
    }

    console.log('ok');
    callback();
  });
};

/**
 * @param {AccManager} self
 * @param {Function} callback
 * @returns {Function}
 */
var getCallback = function(self, callback) {
  return function(err, rows) {
    if(err)
      self.onError(err);
    
    if(!err && rows && rows.length === 1)
      callback(rows[0]);
    else
      callback(null);
  };
};

/**
 * 
 * @param {Number} id
 * @param {Function} callback
 */
AccManager.prototype.getById = function(id, callback) {
  this.connection.query("SELECT * FROM users WHERE id = ?", id, getCallback(this, callback));
};

/**
 * @param {String} nick
 * @param {Function} callback
 */
AccManager.prototype.getByEmail = function(email, callback) {
  this.connection.query("SELECT * FROM users WHERE email = ?", email, getCallback(this, callback));
};

/**
 * @param {Object} values
 * @param {Function} callback
 */
AccManager.prototype.create = function(values, callback) {
  if(!values.nick || values.nick.length < 4)
    return callback(false);
  
  var self = this;
  this.connection.query("INSERT INTO users SET ?", values, function(err, result) {
    if(err)
      self.onError(err);
    
    callback(!err && result !== undefined && result.insertId > 0);
  });
};

/**
 * 
 * @param {Number} id
 * @param {Function} callback
 */
AccManager.prototype.delete = function(id, callback) {
  var self = this;
  this.connection.query("DELETE FROM users WHERE id = ?", id, function(err, result) {
    if(err)
      self.onError(err);
    
    callback(!err && result !== undefined);
  });
};

AccManager.prototype.update = function(id, values, callback) {
  var self = this;
  this.connection.query("UPDATE users SET ? WHERE id = ?", [values, id], function(err, result) {
    if(err)
      self.onError(err);
    
    callback(!err && result !== undefined);
  });
};

AccManager.prototype.activateAccount = function(code, callback) {
  var self = this;
  this.connection.query("UPDATE users SET isActivated = 1, activationCode = NULL WHERE activationCode = ?", code, function(err, result) {
    if(err)
      self.onError(err);
    
    callback(!err && result !== undefined && result.affectedRows > 0);
  });
};

module.exports = AccManager;
