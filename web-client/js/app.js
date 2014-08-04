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
    this.models = { };
    this.utils = { };
    this.modelViews = { };
    
    this.loadScripts();
  };

  var hostname = location.hostname;
  if(!hostname)
    hostname = '127.0.0.1';

  App.prototype.title = {
    _position: -1,
    _handlers: {
      title: function() { return 'syntax.im'; },
      unread: function() {
        if(!this.unread)
          return false;
        
        return this.unread + ' unread message' + (this.unread > 1 ? 's' : ''); }
    },
    _order: ['title', 'unread'],
    
    unread: 0
  };
  
  App.prototype.nextTitle = function() {
    this.title._position = (this.title._position + 1) % this.title._order.length;
    var key = this.title._order[this.title._position];
    var value = this.title._handlers[key].call(this.title);
    
    if(!value)
      return this.nextTitle();
    
    document.title = value;
    
    var self = this;
    setTimeout(function() {
      self.nextTitle();
    }, 1000);
  };

  App.prototype.server = 'https://' + hostname + ':1560';
  App.prototype.scripts = [
    'js/vendor/jquery-1.11.1.min.js',
    'js/vendor/sha256.min.js',
    'js/vendor/bootstrap.min.js',
    'js/vendor/bootbox.min.js',
    'js/vendor/URI.min.js',
    'js/vendor/moment.min.js',
    'js/vendor/jquery.cookie.js',
    'js/vendor/howler.min.js',
    'js/vendor/knockout-3.1.0.min.js',
    'js/lib/utils.js',
    'js/lib/emoticons.js',
    'js/lib/links.js',
    'js/lib/api.js',
    'js/lib/appmodelview.js',
    'js/lib/models.js',
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
        self.initSfxs();
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
  
  App.prototype.sfxs = ['o-ou'];
  App.prototype.initSfxs = function() {
    var cache = { };
    
    for(var k in this.sfxs) {
      var n = this.sfxs[k];
      
      cache[n] = new Howl({
        urls: ['sfx/' + n + '.ogg', 'sfx/' + n + '.mp3']
      });
    }
    
    this.sfxs = cache;
  };
  
  App.prototype.initSocket = function() {
    var self = this;
    this.io = io(this.server);
    $('#loadingProgressBar').text('connecting to chat server');
    this.io.on('connect', function() {
      $('#loadingProgressBar').text('done');
      self.io.removeAllListeners('connect');
      
      try {
        self.init();
      } catch(err) {
        console.error('init error', err);
      }
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
  
  App.prototype.isFocused = true;
  App.prototype.init = function() {
    var self = this;
    $(window).on('focus', function() {
      self.isFocused = true;

      self.title.unread = 0;
    });
    $(window).on('blur', function() {
      self.isFocused = false;
    });
    
    this.nextTitle();
    this.api = new this.utils.Api();
    this.appModelView = new this.modelViews.AppModelView();
    ko.applyBindings(this.appModelView);
    
    $('div.loading').fadeOut(200);
    
    this.initActivation();
  };
  
  document.syntaxApp = new App();
})();