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

define(['jquery'], function($) {
  function Bus() {}
  
  Bus.prototype._subscribers = {};
  
  Bus.prototype._hasListener = function(event) {
    return (event in this._subscribers) && this._subscribers.hasOwnProperty(event);
  };
  
  Bus.prototype.subscribe = function(event, listener) {
    if(!this._hasListener(event))
      this._subscribers[event] = [];
    
    this._subscribers[event].push(listener);
  };
  
  Bus.prototype.unsubscribe = function(event, listener) {
    if(!this._hasListener(event))
      return;
    
    this._subscribers[event] = $.grep(this._subscribers[event], function(e) {
      return e !== listener;
    });
  };
  
  /**
   * @deprecated
  */
  Bus.prototype.post = function() {
    Bus.prototype.trigger.apply(this, arguments);
  };
  
  Bus.prototype.trigger = function(event, data1, data2, dataN) {
    if(!this._hasListener(event))
      return;
      
    var args = Array.prototype.slice.call(arguments, 1);
    
    //console.log('bus', event, args);
    
    $.each(this._subscribers[event], function(i, listener) {
      try {
        listener.apply(undefined, args);
      } catch(e) {
        console.error('Bus listener error:', e);
      }
    });
  };
  
  Bus.prototype.userStorage = null;
  
  return new Bus();
});