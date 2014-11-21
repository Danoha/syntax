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

define(['../vendor/knockout', 'jquery', '../app', 'require'], function (ko, $, app, require) {
  var BaseScreen = function (selector, templateName) {
    this._selector = 'body > ' + selector;
    this._templateName = templateName;
  };

  BaseScreen.prototype._selector = '';
  BaseScreen.prototype._templateName = '';

  BaseScreen.prototype._create = function (callback) {
    require(['../vendor/require.text!../templates/' + this._templateName + '.html'], function (template) {
      var ret = $('<div>').html(template).contents();

      if (ret.length !== 1)
        throw new Error('Screen template has invalid root element count.');

      callback(ret);
    });
  };

  BaseScreen.prototype.hide = function () {
    if (this.onReset)
      this.onReset();

    var old = $(this._selector).addClass('fade').fadeOut(function () {
      old.remove();
    });
  };

  BaseScreen.prototype.show = function () {
    this.hide();

    var self = this;
    this._create(function (view) {
      view.hide().addClass('fade').fadeIn(function () {
        if (self.onShown)
          self.onShown();
        view.removeClass('fade');
      });
      $("body").prepend(view);

      if (self.onInit)
        self.onInit();

      ko.applyBindings(self, view.get(0));
    });
  };

  return BaseScreen;
});