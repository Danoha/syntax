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

define(['../vendor/howler'], function(howler) {
  var SoundManager = function() {
    this._initSfxs();
  };
  
  SoundManager.prototype._sfxs = ['o-ou'];
  
  SoundManager.prototype._initSfxs = function() {
    var cache = { };
    
    for(var k in this._sfxs) {
      var n = this._sfxs[k];
      
      cache[n] = new howler.Howl({
        urls: ['sfx/' + n + '.ogg', 'sfx/' + n + '.mp3']
      });
    }
    
    this._sfxs = cache;
  };
  
  SoundManager.prototype.play = function(name) {
    this._sfxs[name].play();
  };
  
  return new SoundManager();
});