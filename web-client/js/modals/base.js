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

define(['jquery', '../vendor/bootbox', 'require', '../vendor/knockout'], function($, bootbox, require, ko) {
  function BaseModal(templateName) {
    this._templateName = templateName;
    this._titleElement = $('<span>');
    this._modal = null;

    this.title = ko.observable('');
    this.isVisible = ko.observable(false);
    this.hasCloseButton = true;

    this.content = null;
    this.viewModel = {};

    this.onTemplateLoad = [];
    this.onShow = [];
    this.onShown = [];

    var self = this;
    this.isVisible.subscribe(function(newValue) {
      if (newValue)
        self._show();
      else
        self._hide();
    });
    
    this.title.subscribe(function(newValue) {
      self._titleElement.text(newValue);
    });

    this._loadTemplate();
  }

  BaseModal.prototype._trigger = function(event) {
    event = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
    var listeners = this[event];

    if (!$.isArray(listeners))
      return;

    $.each(listeners, function(i, cb) {
      try {
        cb();
      }
      catch (e) {
        console.error('Modal listener error (' + event + '):', e);
      }
    });
  };

  BaseModal.prototype._loadTemplate = function() {
    var self = this;
    require(['../vendor/require.text!../templates/' + this._templateName + '.html'], function(template) {
      var ret = $('<div>').html(template).contents();

      if (ret.length !== 1)
        throw new Error('Modal template has invalid root element count.');

      self.content = ret.get(0);
      self._trigger('templateLoad');
    });
  };

  BaseModal.prototype._show = function() {
    var self = this;

    function done() {
      if (self._modal !== null)
        return;

      self.isVisible(true);
      self._modal = bootbox.dialog({
        title: self._titleElement,
        message: self.content,
        closeButton: self.hasCloseButton
      });

      ko.applyBindings(self.viewModel, self.content);
      
      self._trigger('show');

      self._modal.one('shown.bs.modal', function() {
        self._trigger('shown');
      });
    }

    if (this.content !== null)
      done();
    else
      this.onTemplateLoad.push(done);
  };

  BaseModal.prototype._hide = function() {
    if(this._modal === null)
      return;
    
    var modal = this._modal;
    this._modal = null;
    
    modal.modal('hide');
    this._trigger('hide');
    
    var self = this;
    modal.one('hidden.bs.modal', function() {
      self._trigger('hidden');
    });
  };
  
  BaseModal.prototype.show = function() {
    this.isVisible(true);
  };
  
  BaseModal.prototype.hide = function() {
    this.isVisible(false);
  };

  return BaseModal;
});