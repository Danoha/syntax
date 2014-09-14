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

define([
  'jquery', '../vendor/bootbox', 'require', '../vendor/knockout', './base', '../core/bus',
  '../vendor/require.text!../templates/settings/embedding.html',
  '../vendor/require.text!../templates/settings/preview.html'
  ], function($, bootbox, require, ko, BaseModal, bus, embeddingHtml, previewHtml) {
  
  function setDefault(key, value) {
    var storage = bus.userStorage;
    
    var val = storage.get(key);
    if(val === undefined)
      storage.set(key, value);
  }
  
  function htmlToContents(html) {
    return $('<div>').html(html).contents();
  }
  
  function observableToStorage(obs, key) {
    var storage = bus.userStorage;
    
    obs.subscribe(function(newValue) {
      storage.set(key, newValue);
    });
    
    var val = storage.get(key);
    obs(val);
  }
  
  function SettingsModal() {
    BaseModal.call(this, 'settings');
    this.title('options');

    this.viewModel.sections = [{
        title: 'embed',
        name: 'embedding',
        html: htmlToContents(embeddingHtml),
        viewModel: {
          allowSpotify: ko.observable(),
          allowTwitch: ko.observable(),
          
          allowYoutube: ko.observable(),
          youtubeReplace: ko.observable(),
        }
      }, {
        title: 'preview',
        name: 'preview',
        html: htmlToContents(previewHtml),
        viewModel: {
          allowImages: ko.observable(),
          allowYoutube: ko.observable()
        }
      }
    ];
    
    var activeSection = ko.observable(this.viewModel.sections[0].name);
    
    this.viewModel.isSectionActive = function(section) {
      var name = section.name;
      if(!name && section.getAttribute)
        name = section.getAttribute('name');
      return name === activeSection();
    };
    
    this.viewModel.openSection = function(section) {
      activeSection(section.name);
    };
    
    this.viewModel.getSectionClassList = function(section) {
      var ret = {};
      ret[section.name] = true;
      return ret;
    };
    
    var embedVM = this.viewModel.sections[0].viewModel;
    var previewVM = this.viewModel.sections[1].viewModel;
    
    observableToStorage(embedVM.allowSpotify, 'embed.spotify.enabled');
    observableToStorage(embedVM.allowTwitch, 'embed.twitch.enabled');
    
    observableToStorage(embedVM.allowYoutube, 'embed.youtube.enabled');
    observableToStorage(embedVM.youtubeReplace, 'embed.youtube.replace');
    
    observableToStorage(previewVM.allowImages, 'preview.images.enabled');
    observableToStorage(previewVM.allowYoutube, 'preview.youtube.enabled');
  }
  
  $.extend(SettingsModal.prototype, BaseModal.prototype);
  SettingsModal.prototype.constructor = SettingsModal;
  
  SettingsModal.setDefaults = function() {
    setDefault('embed.spotify.enabled', true);
    setDefault('embed.twitch.enabled', true);
    
    setDefault('embed.youtube.enabled', true);
    setDefault('embed.youtube.replace', false);
    
    setDefault('preview.images.enabled', true);
    setDefault('preview.youtube.enabled', true);
  };
  
  return SettingsModal;
});