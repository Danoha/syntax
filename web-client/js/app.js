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

(function() {
  var App = function() {
    var self = this;
    $.getScript(this.server + '/socket.io/socket.io.js', function() {
      self.io = io(self.server);
      
      $(function() {
        self.init();
      });
    });
  };

  var hostname = location.hostname;
  if(!hostname)
    hostname = '127.0.0.1';

  App.prototype.server = 'https://' + hostname + ':1560';
  App.prototype.init = function() {
    var self = this;
    
    var createAccount = $('form.create-account');
    this.io.on('create account', function(result) {
      createAccount.find('span.result').text(result);
    });
    
    createAccount.submit(function() {
      self.io.emit('create account', {
        email: createAccount.find('[name=email]').val(),
        nick: createAccount.find('[name=nick]').val(),
        hash: CryptoJS.SHA256(createAccount.find('[name=password]').val()).toString()
      });
      
      return false;
    });
    
    var login = $('form.login');
    this.io.on('login', function(result) {
      login.find('span.result').text(result);
    });
    
    login.submit(function() {
      self.io.emit('login', {
        email: login.find('[name=email]').val(),
        hash: CryptoJS.SHA256(login.find('[name=password]').val()).toString()
      });
      
      return false;
    });
    
    var logout = $('form.logout');
    this.io.on('logout', function(result) {
      logout.find('span.result').text(result);
    });
    
    logout.submit(function() {
      self.io.emit('logout');
      
      return false;
    });
    
    var activateAccount = $('form.activate-account');
    this.io.on('activate account', function(result) {
      activateAccount.find('span.result').text(result);
    });
    
    activateAccount.submit(function() {
      self.io.emit('activate account', {
        code: activateAccount.find('[name=code]').val()
      });
      
      return false;
    });
  };

  document.syntaxApp = new App();
})();