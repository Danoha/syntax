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
  var Api = function(io) {
    this.io = io;
  };
  
  Api.prototype.on = function(eventName, listener) {
    this.io.on(eventName, listener);
  };

  Api.prototype.chatMessage = function(data) {
    this.io.emit('chat message', data);
  };

  Api.prototype.logout = function(callback) {
    var self = this;
    self.io.on('logout', function(result) {
      self.io.removeAllListeners('logout');
      
      callback(result);
    });
    
    self.io.emit('logout');
  };
  
  Api.prototype.login = function(email, password, callback) {
    var self = this;
    self.io.on('login', function(result) {
      self.io.removeAllListeners('login');
      
      callback(result);
    });
    
    self.io.emit('login', {
      email: email,
      hash: CryptoJS.SHA256(password).toString()
    });
  };
  
  Api.prototype.activateAccount = function(code, callback) {
    var self = this;
    self.io.on('activate account', function(result) {
      self.io.removeAllListeners('activate account');
      
      callback(result);
    });
    
    self.io.emit('activate account', {
      code: code
    });
  };
  
  Api.prototype.createAccount = function(email, nick, password, callback) {
    var self = this;
    self.io.on('create account', function(result) {
      self.io.removeAllListeners('create account');
      
      callback(result);
    });
    
    self.io.emit('create account', {
      email: email,
      nick: nick,
      hash: CryptoJS.SHA256(password).toString()
    });
  };
  
  ////
  
  var AppModelView = function(api) {
    var self = this;
    self.createAccount = { email: "", nick: "", password: "", passwordAgain: "", submit: function() {
        if(self.createAccount.nick.length < 4) {
          bootbox.alert('nick is too short');
          return;
        }
        
        if(self.createAccount.password.length < 5) {
          bootbox.alert('password is too short');
          return;
        }
        
        if(self.createAccount.password !== self.createAccount.passwordAgain) {
          bootbox.alert('passwords do not match');
          return;
        }
        
        var wait = bootbox.dialog({
          message: 'please wait',
          title: 'creating account',
          closeButton: false
        });
        
        api.createAccount(self.createAccount.email, self.createAccount.nick, self.createAccount.password, function(result) {
          wait.modal('hide');
          
          var message;
          switch(result) {
            case 'OK':
              message = 'your account has been created, please check your inbox and click on activation link';
              break;
            case 'ERR_INVALID_VALUES':
              message = 'invalid values were entered';
              break;
            case 'ERR_ALREADY_USED':
              message = 'given email address is already used';
              break;
            default:
              message = 'an error occured, please contact support';
              break;
          }
          
          bootbox.alert(message);
        });
    }};
  
    self.login = { email: "", password: "", submit: function() {
        var wait = bootbox.dialog({
          message: 'please wait',
          title: 'logging in',
          closeButton: false
        });
        
        api.login(self.login.email, self.login.password, function(result) {
          wait.modal('hide');
          
          var message = null;
          switch(result) {
            case 'ERR_NOT_ACTIVATED':
              message = 'account is not activated';
              break;
            case 'ERR_NOT_FOUND':
              message = 'email or password incorrect';
              break;
            case 'ERR_INVALID_VALUES':
              message = 'invalid values were entered';
              break;
            default:
              var acc = self.app.account;
              for(var k in result) {
                if(k in acc)
                  acc[k](result[k]);
              }
              $('div.account').fadeOut(200);
              break;
          }
          
          if(message !== null)
            bootbox.alert(message);
        });
    }};
  
    var composerSubmit = function() {
      var text = self.app.composer.text();
      if(text.trim().length === 0)
        return;
      
      self.app.composer.text('');
      
      api.chatMessage({
        sender: self.app.account.nick(),
        text: text,
        time: moment().unix()
      });
    };
  
    self.app = {
      account: {
        id: ko.observable(0),
        nick: ko.observable(''),
        logout: function() {
          bootbox.confirm('do you really want to logout?', function(result) {
            if(result) {
              api.logout();
              $('div.account').fadeIn(200);

              self.app.account.id(0);
              self.app.account.nick('');
              
              self.app.messages([]);
              
              self.app.composer.text('');
            }
          });
        }
      },
      messages: ko.observableArray(),
      composer: {
        text: ko.observable(''),
        submit: composerSubmit
      },
      formatTime: function(date) {
        return moment.unix(date).format('HH:mm');
      }
    };
    
    api.on('chat message', function(data) {
      self.app.messages.push(data);
    });
  };
  
  ////
  
  var App = function() {
    this.loadScripts();
  };

  var hostname = location.hostname;
  if(!hostname)
    hostname = '127.0.0.1';

  App.prototype.server = 'https://' + hostname + ':1560';
  App.prototype.scripts = [
    'js/jquery-1.11.1.min.js',
    'js/knockout-3.1.0.min.js',
    'https://crypto-js.googlecode.com/svn/tags/3.1.2/build/rollups/sha256.js',
    'js/bootstrap.min.js',
    'js/bootbox.min.js',
    'js/URI.min.js',
    'js/moment.min.js',
    App.prototype.server + '/socket.io/socket.io.js'
  ];
  
  App.prototype.loadScripts = function() {
    var progressBar = null;
    var pb = function() {
      progressBar = document.getElementById('loadingProgressBar');
    };
    
    var stack = this.scripts;
    var self = this;
    var total = stack.length;
    
    var next = function() {
      if(stack.length === 0) {
        self.initSocket();
        return;
      }
      
      var url = stack.shift();
    
      pb();
      if(progressBar !== null)
        progressBar.innerHTML = url;
      
      var script = document.createElement('script');
      document.head.appendChild(script);
      script.onload = function() {
        var current = stack.length;
        var percent = ((total - current) * 100) / total;
        
        pb();
        if(progressBar !== null)
          progressBar.style.width = percent + '%';
        
        next();
      };
      script.onerror = function() {
        setTimeout(function() {
          pb();
          progressBar.innerHTML = 'error, could not load ' + url;
          progressBar.style.width = '100%';
          progressBar.className = 'progress-bar progress-bar-danger';
        }, 0);
      };
      script.src = url;
    };
    
    next();
  };
  
  App.prototype.initSocket = function() {
    var self = this;
    this.io = io(this.server);
    $('#loadingProgressBar').text('connecting to chat server');
    this.io.on('connect', function() {
      $('#loadingProgressBar').text('done');
      self.io.removeAllListeners('connect');
      self.init();
    });
  };
  
  App.prototype.activate = function(code) {
    var wait = bootbox.dialog({
      message: 'please wait',
      title: 'activating your account',
      closeButton: false
    });
    
    this.api.activateAccount(code, function(result) {
      wait.modal('hide');
      
      var message;
      switch(result) {
        case 'OK':
          message = 'your account has been activated';
          break;
        case 'ERR_NOT_FOUND':
          message = 'error, your code is invalid';
          break;
      }
      
      bootbox.alert(message);
    });
  };
  
  App.prototype.initActivation = function() {
    var self = this;
    var query = URI.parseQuery(location.search);
    if(query && query.activate) {
      $(function() {
        self.activate(query.activate);
      });
    }
  };
  
  App.prototype.init = function() {
    this.api = new Api(this.io);
    this.modelView = new AppModelView(this.api);
    ko.applyBindings(this.modelView);
    
    $('div.loading').fadeOut(200);
    
    this.initActivation();
  };

  document.syntaxApp = new App();
})();