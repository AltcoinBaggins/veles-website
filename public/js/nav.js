var velesSinglePageApp = {
	'explorerUrl': 'http://35.240.96.108:88',
	'currentPage': null,
	'language': 'en',
	'defaultLanguage': 'en',
	'pageSuffix': '.html',
	'pageHooks': {},
	'cachedPages': {'en': {}, 'zh': {}, 'es':{}, 'tc':{}},
	'eventsBound': {},
	'menuTreeIndex': {},
	'menuTemplates': {},
	'sidebarPadContent': 0,
	'$window': null,
	'$animationElements': null,
	'inViewThresholdPx': 75,
	'scrollMinStep': 50,
	'scrollLastPos': 0,
	'parallaxBottom': null,
	'wikiIndex': null,
	'wikiIndexUrl': 'wiki/pages/{language}/pages.json',

	'go': function(page) {
		if (!page)	// prevent error if wrong link/element's event gets bound with this method 
			return;

		var pageHash = null;
		var pageLanguage = self.language;
		var pageType = null;
		var pageNameParts = page.split('.');

		// parse "extensions" separated by dots in page's name
		if (pageNameParts.length > 1)
			pageLanguage = pageNameParts.pop();	// pop language part

		if (pageNameParts.length > 1)
			pageType = pageNameParts[pageNameParts.length - 1];	// don't pop, keep in page's name

		page = pageNameParts.join('.');

		// check for supported languages
		if (!this.cachedPages.hasOwnProperty(pageLanguage)) {
			pageLanguage = this.defaultLanguage;
		}

		// pages with hash just to scroll to target anrchor
		if (page.indexOf('#') != -1) {
			pageHash = '#' + page.split('#')[1];
			page = page.split('#')[0];
		}

		//} else if (window.location.hash)
		//    pageHash = window.location.hash;

		if (page == '')
			page = (this.currentPage) ? this.currentPage : 'index';

		// just scroll to top if its the same page in the same language
		if ((this.currentPage == page && this.language == pageLanguage) || page == '') {
			if (pageHash && $(pageHash).length) {
				$('html, body').animate({ scrollTop: ($(pageHash).offset().top - 60) }, 50);
			} else {
				window.scrollTo(0,0);
			}
			return;
		}

		// cache the previous HTML, remove classname that marks the events has been bound,
		// as we'll need to restore them again after loading from cache.
		$('#content-wrapper').find('.spa').removeClass('spa');
		this.cachedPages[this.language][this.currentPage] = $('#content-wrapper').html();

		// change the current page pointers and links
		this.currentPage = page;
		this.setActive(page);

		// change the current language according to the page address
		this.language = pageLanguage;

		// change browser's url filed
		if (history.pushState) {
			window.history.pushState(
				{'currentPage': page},
				this.getTitle(),
				"./" + page + '.' + this.language + this.pageSuffix
				);
		} else {
			document.location.href = "./" + page + '.' + this.language + this.pageSuffix;
		}

		// close the menu if open
		$('div.navbar-collapse').removeClass('show');
		$('div.navbar-collapse').addClass('hide');
		//

		// load the content if not cached, init the page scripts
		if (this.cachedPages[this.language].hasOwnProperty(page)) {
			$('#content-wrapper').html(this.cachedPages[this.language][page]);
			velesSinglePageApp.hideOverlay();
			velesSinglePageApp.hideMobileMenu();
			velesSinglePageApp.runPageHook('init', page, pageType);
			velesSinglePageApp.rebuildPageMenu(page, true);
			velesSinglePageApp.updateTemplate();
			velesSinglePageApp.initPageAnimations();
			velesSinglePageApp.bindEvents();
			velesChain.replayEvents();
		} else {
			var pageSource = './pages/';

			if (pageType == 'wiki')
				pageSource = './wiki/pages/';

			if (pageType == 'news')
				pageSource = './news/pages/';

			$('#content-wrapper').load(pageSource + this.language + '/' + pageNameParts[0] + '.html' + ' #content', null, function() {
				velesSinglePageApp.hideOverlay();
				velesSinglePageApp.hideMobileMenu();
				velesSinglePageApp.runPageHook('init', page, pageType);
				velesSinglePageApp.rebuildPageMenu(page, false);
				velesSinglePageApp.updateTemplate();
				velesSinglePageApp.autoAddIds();
				velesSinglePageApp.initPageAnimations();
				velesSinglePageApp.bindEvents();
				velesChain.replayEvents();
			});
		}

		// just start scrolling to the top
		if (pageHash && $(pageHash).length)
			$('html, body').animate({ scrollTop: ($(pageHash).offset().top - 60) }, 50);
		else
			window.scrollTo(0,0);
	},

	'autoAddIds': function() {
		$('h2').add('h3').each(function(i){
			if (!$(this).parents('.row').length)
				return;

			if (!$(this).parents('.row').eq(0).attr('id')) {
				$(this).parents('.row').eq(0).attr('id', $(this).text()
					.toLowerCase().replace(': ', '').replace(' ', '-')
					.trim());
			}
		});
		$('h4').each(function(i){
			if (!$(this).parents('div.card').length)
				return;

			if (!$(this).parents('div.card').eq(0).attr('id')) {
				$(this).parents('div.card').eq(0).attr('id', $(this).text()
					.toLowerCase().replace(': ', '').replace(' ', '-')
					.trim());
			}
		});
	},

	'updateTemplate': function() {
		if (this.menuTemplates.hasOwnProperty(velesSinglePageApp.currentPage)) {
			$('[data-id="page.title"]').text(velesSinglePageApp.menuTreeIndex[velesSinglePageApp.currentPage].title);
			$('[data-id="page.url"]').text(velesSinglePageApp.menuTreeIndex[velesSinglePageApp.currentPage].title);
		}
	},

	'addPageHook': function(pageName, hookName, callback) {
		if (!pageName)
			pageName = '*';

		if (!this.pageHooks.hasOwnProperty(pageName))
			this.pageHooks[pageName] = {}

		this.pageHooks[pageName][hookName] = callback;
	},

	'addCategoryHook': function(hookName, catName, callback) {
		this.addPageHook('.' + catName, hookName, callback);
	},

	'addHook': function(hookName, callback) {
		this.addPageHook(null, hookName, callback);
	},

	'runPageHook': function(hookName, pageName = null, pageType = null) {
		// run hooks for a specific page, eg. index
		if (this.pageHooks.hasOwnProperty(pageName) && this.pageHooks[pageName].hasOwnProperty(hookName))
			this.pageHooks[pageName][hookName]();

		// run hooks for certain page types, defined in the index by dot 
		if (pageType && (this.pageHooks.hasOwnProperty('.' + pageType) && this.pageHooks['.' + pageType].hasOwnProperty(hookName)))
			this.pageHooks['.' + pageType][hookName]();

		// and call listeners applicable for all pages
		if (this.pageHooks.hasOwnProperty('*') && this.pageHooks['*'].hasOwnProperty(hookName))
			this.pageHooks['*'][hookName]();
	},

	'setActive': function(page = null) {
		if (!page)
			page = this.currentPage;

		$('.nav-active').removeClass('nav-active'); // deactivate previously active tabs

		if (page == 'index')    // main index link is a special one
			$('a.navbar-brand').addClass('nav-active');

		else
			$('a[href$="' + page + this.pageSuffix + '"].nav-link').parent('li').addClass('nav-active');
	},

	'detectCurrentPageAddr': function() {
		var filename = $(window.location.pathname.split('/')).get(-1);
		var page = (filename) ? filename.replace('.html', '') : 'index.en';

		return page;
	},

	'getAddrPageName': function(page) {
		return (page.indexOf('.') != -1) ? page.split('.')[0] : page;
	},

	'getAddrPageLanguage': function(page) {
		return (page.indexOf('.') != -1) ? $(page.split('.')).get(-1) : this.defaultLanguage;
	},

	'getTitle': function(page = null) {
		// todo: load titles from JSON or parse from loaded content
		return $('title').text();
	},

	'bindEvents': function() {
		// History changed event
		if (!this.eventsBound.hasOwnProperty('popstate') || !this.eventsBound['popstate']) {
			$(window).bind('popstate', function(e) {
				if (e.originalEvent.state && e.originalEvent.state.hasOwnProperty('currentPage'))
					velesSinglePageApp.go(e.originalEvent.state.currentPage);
				else
					velesSinglePageApp.go();
			});
			this.eventsBound['popstate'] = true;
		}

		if (!this.eventsBound.hasOwnProperty('scroll') || !this.eventsBound['scroll']) {
			$(window).bind('scroll resize', velesSinglePageApp.trackInView);
			this.eventsBound['scroll'] = true;
		}

		if (!this.eventsBound.hasOwnProperty('navbar-toggler') || !this.eventsBound['navbar-toggler']) {
			$('.navbar-collapse').on('show.bs.collapse', function () {
				velesSinglePageApp.showMobileMenu();
			});
			$('.navbar-collapse').on('hide.bs.collapse', function () {
				velesSinglePageApp.hideMobileMenu();
			});
			$('#mobile-follow-toggle').click(function(){
				if (velesSinglePageApp.isMobileSliderShown())
					velesSinglePageApp.hideMobileSlider();
				else
					velesSinglePageApp.showMobileSlider();
			})

			$('body').resize(function(){
				if ($('.sidebar').hasClass('sidebar-expand'))
					velesSinglePageApp.sidebarResizePage();
			});

			this.eventsBound['navbar-toggler'] = true;
		}

		// Click events on navigation links
		$('.nav-link').not('.dropdown-toggle')
			.add('.navbar-brand')
			.add('.dropdown-item')
			.add('.nav-vertical a')
			.add('.breadcrumb-item a')
			.add('.sidebar a')
			.add('a.nav-page')
			.add('a.wikilink')
			.not('.bootstrap-autocomplete a')	// just in case
			.not('.nav-external-app')
			.not('.spa').click(function(e) {
		   e.preventDefault();
		   velesSinglePageApp.go($(this).attr('href').replace(velesSinglePageApp.pageSuffix, ''));
		}).addClass('spa');
	},

	'hideOverlay': function(overlayName = null, fade = true, delay = 3000) {
		if (overlayName == null)
			overlayName = 'content-overlay';
		else
			overlayName += '-overlay';

		if (!this.isOverlayShown(overlayName))
			return;

		if (fade)
			$('#' + overlayName).fadeOut(delay);

		$('#content').addClass(overlayName + '-initial');
		$('#' + overlayName).addClass(overlayName + '-initial');

		window.setTimeout(function() {
			if (!fade)
				$('#' + overlayName).hide();

			$('#content').removeClass(overlayName + '-initial');
			$('#content').removeClass(overlayName);
			$('#' + overlayName).removeClass(overlayName + '-initial');
			$('body').removeClass('with-overlay');
		}, delay);
	},

	'showOverlay': function(overlayName = null, fade = true, delay = 3000) {
		if (overlayName == null)
			overlayName = 'content-overlay';
		else
			overlayName += '-overlay';

		if (this.isOverlayShown(overlayName))
			return;

		// some extra UI stuff
		this.hideMobileSlider();

		$('#' + overlayName).addClass(overlayName + '-initial');
		$('#content').addClass(overlayName + '-initial');
		$('#content').addClass(overlayName);

		if (fade)
			$('#' + overlayName).fadeIn(delay);
		else
			$('#' + overlayName).show();

		$('#' + overlayName).removeClass(overlayName + '-initial');
		$('#content').removeClass(overlayName + '-initial');
	},

	'isOverlayShown': function(overlayName) {
		return $('#' + overlayName).is(':visible');
	},

	'showMobileMenu': function() {
		this.showOverlay('mobile-menu', false, 2000);
		$('.navbar').addClass('mobile-menu');
	},

	'hideMobileMenu': function() {
		this.hideOverlay('mobile-menu', false, 100);
		$('.navbar').removeClass('mobile-menu');
	},

	'isMobileMenuShown': function() {
		return this.isOverlayShown('mobile-menu');
	},

	'showMobileSlider': function() {
		if (this.isMobileSliderShown())
			return;

		$('#mobile-follow-toggle').addClass('active');
		$('.footer-overlay').addClass('footer-panel-slide');
		$('#content').addClass('footer-panel-slide');
	},

	'hideMobileSlider': function() {
		if (!this.isMobileSliderShown())
			return;

		$('#mobile-follow-toggle').removeClass('active');
		$('.footer-overlay').removeClass('footer-panel-slide');
		$('#content').removeClass('footer-panel-slide');
	},

	'isMobileSliderShown': function() {
		return $('.footer-overlay').hasClass('footer-panel-slide');
	},

	'buildMenus': function() {
		this.menuTreeIndex = {};
		this.menuTemplates = {
			'navbar': this.extractTemplates(),
			'sidebar': this.extractTemplates('.sidebar')
		};

		this.buildMenuLevel(menuTree, $('#navbarResponsive ul.navbar-nav'), this.menuTemplates['navbar']);
		//this.buildMenuLevel(menuTree, $('.sidebar ul'), this.menuTemplates['sidebar']);

		$('.navbar .template').removeClass('template');
	},

	'rebuildPageMenu': function(page, cachedPage = false) {
		// update language-selector menu to point to other language mutations
		// of the current page
		$('#languageSelectorBar').find('a').each(function(){
			$(this).attr('href', page + '.' + $(this).attr('href').split('.')[1] + velesSinglePageApp.pageSuffix); 
		});

		// Rebuild sidebar
		$('.sidebar ul').html('');

		if (!this.menuTreeIndex.hasOwnProperty(page)){
			// auto-"index" pages with known parend according to their type
			if (page.indexOf('.') && this.menuTreeIndex.hasOwnProperty(page.split('.')[1])) {
				console.log('[Sidebar] Page tree auto-indexing: ' + page);
				this.menuTreeIndex[page] = {
					'parent': page.split('.')[1]
				}
			} else {
				console.log('[Sidebar] Page tree not indexed: ' + page);
				return;
			}
		}

		if (this.menuTreeIndex[page].hasOwnProperty('sections')) {
			this.buildMenuLevel(
				this.menuTreeIndex[page].sections,
				$('.sidebar ul'),
				this.menuTemplates['sidebar'],
				page,
				isSectionLinks = true
			);
			this.sidebarCollapse();

		} else if (this.menuTreeIndex[page].hasOwnProperty('items')) {
			this.buildMenuLevel(
				this.menuTreeIndex[page].items,
				$('.sidebar ul'),
				this.menuTemplates['sidebar'],
				page
			);
			this.sidebarCollapse();

		} else if (this.menuTreeIndex[page].parent && this.menuTreeIndex[this.menuTreeIndex[page].parent].hasOwnProperty('items')) {
			this.buildMenuLevel(
				this.menuTreeIndex[this.menuTreeIndex[page].parent].items,
				$('.sidebar ul'),
				this.menuTemplates['sidebar'],
				page.parent
			);
			// expand sidebar when parent is menu, on larger screens
			this.sidebarExpand();

			if (!cachedPage)
				this.sidebarResizePage();

		} else {
			this.sidebarCollapse();
		}
	},

	'extractTemplates': function(context = null) {
		var menuTemplates = {};

		if (!context) {
			menuTemplates['subMenuItem'] = $('.dropdown-item.template')[0].outerHTML;
			$('.dropdown-item.template').remove();

			menuTemplates['menuDropdown'] = $('.nav-item.dropdown.template')[0].outerHTML;
			$('.nav-item.dropdown.template').remove();

			menuTemplates['menuItem'] = $('.nav-item.template')[0].outerHTML;
			$('.nav-item.template').remove();

		} else {
			menuTemplates['subMenuItem'] = $(context).find('.submenu-item.template')[0].outerHTML;
			$('.submenu-item.template').remove();

			menuTemplates['menuDropdown'] = $(context).find('.menu-item.submenu.template')[0].outerHTML;
			$('.menu-item.submenu.template').remove();

			menuTemplates['menuItem'] = $(context).find('.menu-item.template')[0].outerHTML;
			$('.menu-item.template').remove();
		}

		return menuTemplates;
	},

	'sidebarExpand': function() {
		if ($('body').width() > 990 ) {
			if (!$('.sidebar').hasClass('sidebar-expand')) {
				$('.sidebar').addClass('sidebar-expand');
			}
		}
	},

	'sidebarCollapse': function() {
		$('.sidebar').removeClass('sidebar-expand');
	},

	'sidebarResizePage': function() {
		if ($('body').width() > 990) {
			$('#content').css('padding-left', 0);
			this.sidebarPadContent = (($('body').width() * 0.2) + 50 - (($('body').width()-$('#content').width()) / 2));

			if ((($('body').width()-$('#content').width()) / 2) < ($('body').width() * 0.2)) {
				$('#content').css('padding-left', this.sidebarPadContent+'px');
			} else {
				$('#content-wrapper').css('padding-left', 'unset');
			}
		}
	},

	'buildMenuLevel': function(tree, $parent, templates, parentPage = null, isSectionLinks = false) {
		var prevPage = null;
		var url = null;

		for (var i = 0; i < tree.length; i++) {
			if (!tree[i].hasOwnProperty('hideFromNav') && !tree[i].hideFromNav) {
				if (!tree[i].hasOwnProperty('page'))
					tree[i].page = tree[i].title.toLowerCase().replace(' ', '-');

				url = (isSectionLinks)
					? '#' +  tree[i].page
					: tree[i].page + '.' + this.language + this.pageSuffix;

				var hackH = false;

				if(typeof tree[i].url !== "undefined") {
					url = tree[i].url;
					hackH = true;
				}
				if (tree[i].hasOwnProperty('items')) {
					var $item = $(templates['menuDropdown']
						.replace('{{item.title}}', tree[i].title)
						.replace('{{item.url}}', url)
						.replace('{{item.page}}', tree[i].page).replace('{{item.page}}', tree[i].page)
						.replace('class="', (hackH ? 'class="nav-external-app ' : 'class="'))
						);

					$subMenu = $lastItem = $item.appendTo($parent).find('div');
					this.buildMenuLevel(tree[i].items, $subMenu, templates, tree[i].page);

				} else {
					var item = ((parentPage) ? templates['subMenuItem'] : templates['menuItem'])
						.replace('{{item.title}}', tree[i].title)
						.replace('{{item.url}}', url)
						.replace('class="', (hackH ? 'class="nav-external-app ' : 'class="'));

					$lastItem = $parent.append(item);
				}
				if(typeof tree[i].url !== "undefined")
					$lastItem.addClass('external-rul');
			}

			// Index into the smarter structure
			if (!this.menuTreeIndex.hasOwnProperty(tree[i].page)) {
				this.menuTreeIndex[tree[i].page] = tree[i];
				this.menuTreeIndex[tree[i].page].next = null;
				this.menuTreeIndex[tree[i].page].prev = null;
				this.menuTreeIndex[tree[i].page].parent = parentPage;

				if (prevPage) {
					this.menuTreeIndex[prevPage].next = tree[i].page;
					this.menuTreeIndex[tree[i].page].prev = prevPage;
				}
				prevPage = tree[i].page;
			}
		}
	},

	'initPageAnimations': function() {
		this.$animationElements = $('.track-in-view');
		this.$animationElements.removeClass('in-view');
		this.$animationElements.removeClass('was-in-view');

		if (!this.$window)
			this.$window = $(window)

		this.trackInView(false); /* do the first run before rist scroll */
	},

	'trackInView': function(throttle = true) {

		if (velesSinglePageApp.$window.outerWidth() < 800) {
			velesSinglePageApp.$animationElements.addClass('was-in-view');
			return;
		}

		var window_top_position = velesSinglePageApp.$window.scrollTop();

		// index parallax
		if (velesSinglePageApp.currentPage == 'index') {
			if (velesSinglePageApp.parallaxBottom == null) {
				var $parallax = $('.parallax-content');
				velesSinglePageApp.parallaxBottom = $parallax.offset().top + $parallax.outerHeight();
			}
			var parallax_scroll = window_top_position - velesSinglePageApp.parallaxBottom;

			if (parallax_scroll < 0) {
				var margin_top = $('.parallax-content').css('margin-top').replace('px', '');
				var parallax_offset = parallax_scroll / (velesSinglePageApp.parallaxBottom / 300);
				$('.parallax-content').css('margin-top', parallax_offset + 'px');
				$('.parallax-content2').css('margin-top', (parallax_offset / 2) + 'px');
			}
		}

		// throttle by steps in px
		if (velesSinglePageApp.scrollLastPos - window_top_position > velesSinglePageApp.scrollMinStep
				|| window_top_position - velesSinglePageApp.scrollLastPos > velesSinglePageApp.scrollMinStep
				|| !throttle) {
			velesSinglePageApp.scrollLastPos = window_top_position;

			var window_height = velesSinglePageApp.$window.height();
			var window_bottom_position = (window_top_position + window_height);

			$.each(velesSinglePageApp.$animationElements, function() {
				var $element = $(this);
				var element_height = $element.outerHeight();
				var element_top_padding = parseInt($element.css('padding-top'));
				var element_bottom_padding = parseInt($element.css('padding-bottom'));
				var element_top_position = $element.offset().top + element_top_padding;
				var element_bottom_position = $element.offset().top + element_height - element_bottom_padding;

				//check to see if this current container is within viewport
				//if ((element_bottom_position >= window_top_position) && (element_top_position <= window_bottom_position)
				if ((element_bottom_position >= window_top_position)
				  && (element_top_position <= window_bottom_position - velesSinglePageApp.inViewThresholdPx)) {
					if (!$element.hasClass('in-view')) {
						$element.addClass('in-view');
						$element.addClass('was-in-view');;
						console.log('Went in view: ' + $element.attr('id') + ' - eh: ' + element_height
							+ ' etp: ' + element_top_position + ' ebp: ' + element_bottom_position
							+ ' wh: ' + window_height + ' wtp: ' + window_top_position + ' wbp: ' + window_bottom_position);
					}
				} else {
					$element.removeClass('in-view');
				}
			});
		}
	},

	'initWikiAutocomplete': function() {
		// Pre-load the article index first, as the list is not intended to be large
		$.getJSON(this.wikiIndexUrl.replace('{language}', this.language), function (data) {
			velesSinglePageApp.wikiIndex = data;
		});

		// Set-up autocomplete
		$('.wikiAutoComplete').autoComplete({
			'minLength': 1,
			'autoSelect': true,
			'resolver': 'custom',
			'events': {
				'search': function(qry, callback, origJQElement) {
					if (!velesSinglePageApp.wikiIndex) {
						console.log('Warning: wikiAutoComplete not ready yet')
						callback([])
						return;
					}

					var queryResult = [];
					var lastAdded = -1;

					for (var i = velesSinglePageApp.wikiIndex.length - 1; i >= 0; i--) {
						var item = velesSinglePageApp.wikiIndex[i];
						var words = item['title'].toLowerCase().split(' ');

						// search every word of the item
						for (var j = words.length - 1; j >= 0; j--) {
							if (words[j].substring(0, qry.length) == qry.toLowerCase()) {
								queryResult.push({'value': item['page'], 'text': item['title']})
							}
						}
					}
					callback(queryResult);
				}
			}
		});

		// Bind events
		if (!this.eventsBound.hasOwnProperty('wiki-autocomplete') || !this.eventsBound['wiki-autocomplete']) {
			$('.wikiAutoComplete').focusin(function(){
				$('.sidebar').addClass('menu-disabled');
			});
			$('.wikiAutoComplete').focusout(function(){
				$('.sidebar').removeClass('menu-disabled');
			});
			$('.wikiAutoComplete').on('autocomplete.select', function(el,item) {
				// Got to the selected wiki page
				if (item.value != velesSinglePageApp.currentPage) {
					$('.wikiAutoComplete').val('loading ...');
					velesSinglePageApp.addHook('init', function() { $('.wikiAutoComplete').val(''); });
					window.setTimeout(function() { $('.wikiAutoComplete').val('') }, 5000);	// just in case something goes very wrong ... 
					velesSinglePageApp.go(item.value + '.' + velesSinglePageApp.language);
				} else {
					$('.wikiAutoComplete').val('[ The page is already open ]');
					window.setTimeout(function() { $('.wikiAutoComplete').val('') }, 1000);
					window.scrollTo(0,0);
				}
			});
			this.eventsBound['wiki-autocomplete'] = true;
		}
	},

	'start': function() {
		var pageAddr = this.detectCurrentPageAddr();
		this.language = this.getAddrPageLanguage(pageAddr);
		this.currentPage = 'index';
/*
		// Maintenance mode
		if (window.location.host == 'veles.network' || window.location.host == 'www.veles.network') {
			$('.stage').addClass('stage-enlarge');
			$('.face2').add('.face5').text('Website under maintenance');
			$('.face3').add('.face6').text('New content coming soon');
			$('.face4').add('.face1').text('Stay tuned');
			return;
		}
*/
		this.buildMenus();

		// only the index is pre-loaded
		if (this.getAddrPageName(pageAddr) == 'index') {
			this.setActive();
			this.rebuildPageMenu('index', false);
			this.updateTemplate();
			this.autoAddIds();
			this.runPageHook('init', 'index');
			this.hideOverlay();
			this.initPageAnimations();
			this.bindEvents();

			if (window.location.hash)
				$('html, body').animate({ scrollTop: ($(window.location.hash).offset().top - 60) },50);
		} else {
			this.go(pageAddr + window.location.hash);
		}

		// needs to be done only once
		this.initWikiAutocomplete();
	}
}

/* Mark current page's tab as active (if found in main nav) */
$(document).ready(function() {
	velesSinglePageApp.start();
});
