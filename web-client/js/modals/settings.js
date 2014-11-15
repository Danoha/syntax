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
  '../vendor/require.text!../templates/settings/links.html',
  '../vendor/require.text!../templates/settings/codestyle.html',
  '../vendor/highlight.min'
  ], function($, bootbox, require, ko, BaseModal, bus, linksHtml, codestyleHtml) {

  var highlightSheets = [
    {title: 'Default', href: 'css/highlight/default.css'},
    {title: 'Dark', href: 'css/highlight/dark.css'},
    {title: 'FAR', href: 'css/highlight/far.css'},
    {title: 'IDEA', href: 'css/highlight/idea.css'},
    {title: 'Sunburst', href: 'css/highlight/sunburst.css'},
    {title: 'Zenburn', href: 'css/highlight/zenburn.css'},
    {title: 'Visual Studio', href: 'css/highlight/vs.css'},
    {title: 'Ascetic', href: 'css/highlight/ascetic.css'},
    {title: 'Magula', href: 'css/highlight/magula.css'},
    {title: 'GitHub', href: 'css/highlight/github.css'},
    {title: 'Google Code', href: 'css/highlight/googlecode.css'},
    {title: 'Brown Paper', href: 'css/highlight/brown_paper.css'},
    {title: 'School Book', href: 'css/highlight/school_book.css'},
    {title: 'IR Black', href: 'css/highlight/ir_black.css'},
    {title: 'Solarized - Dark', href: 'css/highlight/solarized_dark.css'},
    {title: 'Solarized - Light', href: 'css/highlight/solarized_light.css'},
    {title: 'Arta', href: 'css/highlight/arta.css'},
    {title: 'Monokai', href: 'css/highlight/monokai.css'},
    {title: 'Monokai Sublime', href: 'css/highlight/monokai_sublime.css'},
    {title: 'XCode', href: 'css/highlight/xcode.css'},
    {title: 'Pojoaque', href: 'css/highlight/pojoaque.css'},
    {title: 'Rainbow', href: 'css/highlight/rainbow.css'},
    {title: 'Tomorrow', href: 'css/highlight/tomorrow.css'},
    {title: 'Tomorrow Night', href: 'css/highlight/tomorrow-night.css'},
    {title: 'Tomorrow Night Bright', href: 'css/highlight/tomorrow-night-bright.css'},
    {title: 'Tomorrow Night Blue', href: 'css/highlight/tomorrow-night-blue.css'},
    {title: 'Tomorrow Night Eighties', href: 'css/highlight/tomorrow-night-eighties.css'},
    {title: 'Railscasts', href: 'css/highlight/railscasts.css'},
    {title: 'Obsidian', href: 'css/highlight/obsidian.css'},
    {title: 'Docco', href: 'css/highlight/docco.css'},
    {title: 'Mono Blue', href: 'css/highlight/mono-blue.css'},
    {title: 'Foundation', href: 'css/highlight/foundation.css'},
    {title: 'Atelier Dun - Dark', href: 'css/highlight/atelier-dune.dark.css'},
    {title: 'Atelier Dun - Light', href: 'css/highlight/atelier-dune.light.css'},
    {title: 'Atelier Forest - Dark', href: 'css/highlight/atelier-forest.dark.css'},
    {title: 'Atelier Forest - Light', href: 'css/highlight/atelier-forest.light.css'},
    {title: 'Atelier Heath - Dark', href: 'css/highlight/atelier-heath.dark.css'},
    {title: 'Atelier Heath - Light', href: 'css/highlight/atelier-heath.light.css'},
    {title: 'Atelier Lakeside - Dark', href: 'css/highlight/atelier-lakeside.dark.css'},
    {title: 'Atelier Lakeside - Light', href: 'css/highlight/atelier-lakeside.light.css'},
    {title: 'Atelier Seaside - Dark', href: 'css/highlight/atelier-seaside.dark.css'},
    {title: 'Atelier Seaside - Light', href: 'css/highlight/atelier-seaside.light.css'},
    {title: 'Paraíso - Dark', href: 'css/highlight/paraiso.dark.css'},
    {title: 'Paraíso - Light', href: 'css/highlight/paraiso.light.css'},
    {title: 'Colorbrewer', href: 'css/highlight/color-brewer.css'},
    {title: 'Codepen.io Embed', href: 'css/highlight/codepen-embed.css'},
    {title: 'Kimbie - Dark', href: 'css/highlight/kimbie.dark.css'},
    {title: 'Kimbie - Light', href: 'css/highlight/kimbie.light.css'},
    {title: 'Hybrid', href: 'css/highlight/hybrid.css'}
  ];

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

    return val;
  }

  function SettingsModal() {
    BaseModal.call(this, 'settings');
    this.title('options');

    this.viewModel.sections = [{
        title: 'links',
        name: 'links',
        html: htmlToContents(linksHtml),
        viewModel: {
          enableImagePreview: ko.observable(),
          enableImgurPreview: ko.observable(),
          replaceImgurLink: ko.observable(),
          enableSpotifyEmbed: ko.observable(),
          replaceSpotifyLink: ko.observable(),
          enableTwitchEmbed: ko.observable(),
          enableYoutubePreview: ko.observable(),
          enableYoutubeEmbed: ko.observable(),
          replaceYoutubeLink: ko.observable()
        }
      }, {
        title: 'code style',
        name: 'codestyle',
        html: htmlToContents(codestyleHtml),
        viewModel: {
          styles: [],
          active: ko.observable()
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

    // bind observables to storage
    // LINKS
    var linksVM = this.viewModel.sections[0].viewModel;
    observableToStorage(linksVM.enableSpotifyEmbed, 'embed.spotify.enabled');
    observableToStorage(linksVM.replaceSpotifyLink, 'embed.spotify.replace');
    observableToStorage(linksVM.enableTwitchEmbed, 'embed.twitch.enabled');
    observableToStorage(linksVM.enableYoutubeEmbed, 'embed.youtube.enabled');
    observableToStorage(linksVM.replaceYoutubeLink, 'embed.youtube.replace');
    observableToStorage(linksVM.enableImagePreview, 'preview.images.enabled');
    observableToStorage(linksVM.enableImgurPreview, 'preview.imgur.enabled');
    observableToStorage(linksVM.replaceImgurLink, 'preview.imgur.replace');
    observableToStorage(linksVM.enableYoutubePreview, 'preview.youtube.enabled');

    // CODESTYLE
    var codestyleVM = this.viewModel.sections[1].viewModel;
    var active = observableToStorage(codestyleVM.active, 'codestyle.highlight.title');
    codestyleVM.styles = highlightSheets;
    codestyleVM.active.subscribe(function(newValue) {
      $.each(highlightSheets, function(i, sheet) {
        if(sheet.title === newValue) {
          $('link.highlight-sheet').attr('href', sheet.href);
          return false;
        }
      });
    });

    var self = this;
    this.onShow.push(function() {
      hljs.highlightBlock($(self.content).find('.highlight-preview').get(0));
      codestyleVM.active(active);
    });
  }

  $.extend(SettingsModal.prototype, BaseModal.prototype);
  SettingsModal.prototype.constructor = SettingsModal;

  function apply() {
    var sheetTitle = bus.userStorage.get('codestyle.highlight.title');
    $.each(highlightSheets, function(i, sheet) {
      if(sheet.title === sheetTitle) {
        $('link.highlight-sheet').attr('href', sheet.href);
        return false;
      }
    });
  }

  SettingsModal.setDefaults = function() {
    setDefault('embed.spotify.enabled', true);
    setDefault('embed.spotify.replace', true);

    setDefault('embed.twitch.enabled', true);

    setDefault('embed.youtube.enabled', true);
    setDefault('embed.youtube.replace', true);

    setDefault('preview.images.enabled', true);
    setDefault('preview.imgur.enabled', true);
    setDefault('preview.imgur.replace', true);
    setDefault('preview.youtube.enabled', true);

    setDefault('codestyle.highlight.title', 'Default');

    apply();
  };

  return SettingsModal;
});