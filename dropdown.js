define(function(require) {
  
	// Ensure jQuery is available.
	var $ = (typeof require === "function") ? require("jquery") : window.jQuery;
	if (!$) {
		console.log("Dropdown Widget : could not load jQuery"); 
		return;
	}
	
	/**
	 * 	Dropdown
	 * 
	 * 	Description:
	 * 	This is a generic dropdown widget designed for flexibility. This widget spawns a floating layer that, 
	 * 	by default, is positioned relative to the element (catalyst) that spawned it. In other words, unless 
	 * 	the default positioning behavior of this widget is altered, this dropdown menu will be positioned just 
	 * 	beneath and left-aligned with the element that triggered it.
	 * 
	 * 	This widget is observable via pub-sub events, and various behaviors can be altered or overwritten for 
	 * 	whatever specific UI situation you're dealing with.
	 * 
	 * 	Also, this widget doesn't care where its content comes from. Use the public "render" method to write 
	 * 	an HTML string to the content area.
	 * 
	 * 	Example Usage:
	 *	    var myButton = $("#my-button-catalyst");
	 *	    var myDropdown = new Dropdown(myButton, {
	 *		    className: "sean_connery", 	// optional
	 *		    fadeEffectDuration: 500,	// optional
	 *		    anchorPoint: "right below"	// optional
	 *	    });
	 *	    myDropdown.render("Hello world!");
	 * 
	 * 	@module dropdown
	 * 	@constructor
	 * 	@param {HTMLElement} catalyst : The catalyst element. Interacting with this element (e.g. via "click") 
	 * 		will spawn the dropdown. Interaction is configurable.
	 * 	@param {HashMap} config : Configuration object...
	 * 		{String} anchorPoint : Change the default anchor point of the dropdown. 
	 * 				    Accepted values: "left below" (default), "right below".
	 * 		{String} className : Custom class name(s) to be applied to the root dropdown element.
	 * 		{String} catalystActiveClass : Custom class name(s) to be applied to the catalyst element 
     *                  whenever the dropdown is visible.
	 * 		{Integer} fadeEffectDuration : Duration of fade-in effect for show operation (in ms).
	 * 		{Integer} hideDelay : Duration to wait after a hide-trigger occurs before actually hiding the 
     *                  dropdown (in ms).
	 * 		{Boolean} manualShowEnabled : If TRUE, clicks on the catalyst will NOT toggle dropdown visibility. 
     *                  All "show" operations will need to be handled manually by you. (default: false)
	 * 		{Boolean} mouseBoundaryDetectionEnabled : If FALSE, the dropdown can only be hidden by clicks. It will 
     *                  ignore mouseenter/mouseleave when evaluating whether or not to hide itself. (default: true)
	 * 
	 * 	@events beforeHide, beforeShow, destroy, hide, hideAfterResize, initialize, mouseEnterDropdown, 
     *          mouseLeaveDropdown, position, render, show
	 */
	var Dropdown = function (catalyst, config) {
		
		// Parse arguments.
		if (!catalyst || !catalyst.length) {
			return this._throwError("no catalyst specified");
		}
		
		// Class properties.
		this.catalyst = $(catalyst).first();
		this.catalystActiveClass = null; // Configurable. Optional class name to apply to the catalyst element whenever the dropdown is visible.
		this.anchorPoint = "left below"; // Configurable. Override the default positioning of the dropdown. 
		this.elements = {
			root: null,
			content: null
		};
		this.fadeEffectDuration = 200; // Configurable. Duration of fade effects for showing/hiding the dropdown.
		this.hideDelay = 500; // Configurable. Time to wait (in ms) before hiding the dropdown after a mouseleave event occurs.
		this.isManualShowEnabled = false; // Configurable. By default, the dropdown will be shown if the user clicks on the catalyst. If TRUE, catalyst click listener will be disabled.
		this.isMouseBoundaryDetectionEnabled = true; // Configurable. By default, observe mouse cursor position to determine if the dropdown needs to be hidden.
		this.isMouseCursorInsideDropdown = false; // Observable. Assists with tracking mouseenter & mouseleave w.r.t. showing & hiding the dropdown.
		this.namespace = {
			css: 	"module-dd",        // All elements will have this CSS class prefix.
			event:	"module-dropdown-"  // Namespace for our custom events, unique to this instance. A unique suffix is appended to this value during initialization.
		};
		this.positionOffset = { x: 0, y: 0 }; // Configurable. Offset default positioning by these amounts (in pixels). Configurable via public method "setPositionOffset".
		
		// More initialization...
		this._initialize(config);
		
	};
	
	Dropdown.prototype = {
					
		/********************************************************************************************
		 * 
		 * 	Public Methods
		 * 
		 ********************************************************************************************/
		
		/**
		 *  Cancels a pending "hide" operation.
		 *  @method cancelHide
		 */
		cancelHide: function () {
			if (this.hideTimer) {
				clearTimeout(this.hideTimer);
				this.hideTimer = null;
			}
		},
		
		/**
		 *  Clear the dropdown of content.
		 *  @method clear
		 */
		clear: function () {
			$(this.elements.content).empty();
		},
		
		/**
		 *  Destroy this instance and related DOM pollution.
		 *  @method destroy
		 */
		destroy: function () {
			
			// Notify listeners that this instance is committing seppuku.
			this._fireCustomEvent("destroy");
			
			// Mass unsubscribe all event listeners under this namespace.
			this.catalyst.off("." + this.namespace.event);
			
			// Remove all generated DOM elements. 
			for (var el in this.elements) {
				$(el).remove();
			}
			
			// Remove data attributes from catalyst element.
			this.catalyst.removeData("module-dropdown-id");
			
			// Destroy this instance. Seppuku complete.
			delete this;
		},
		
		/**
		 *  Public access to the utility method that calculates the catalyst element's current position with respect 
         *  to the document. This information is used for calculating where to position the dropdown. It's public 
         *  because this information will be helpful when  writing a custom "setPosition" implementation.
		 *  @method getCatalystPosition
		 *  @returns {HashMap} : XY coordinates of the catalyst, as well as dimensions. e.g. { x:x, y:y, w:width, h:height }
		 */
		getCatalystPosition: function () {
			return this._getCatalystPosition();
		},
		
		/**
		 *  Returns a reference to the root element of the dropdown.
		 *  @method getRootElement
		 *  @returns {HTMLElement} : DOM reference to the root element of the dropdown.
		 */
		getRootElement: function () {
			return (this.elements.root && this.elements.root.length) ? this.elements.root.get(0) : null; 
		},
			
		/**
		 *  Make the DD invisible.
		 *  @method hide
		 */
		hide: function () {
			var rootEl = $(this.elements.root);
			if (!rootEl.is(":animated")) { // ensure we're not in the midst of a fade-out animation
				this._fireCustomEvent("beforeHide");
				this.catalyst.removeClass(this.catalystActiveClass);
				rootEl.fadeOut(this.fadeEffectDuration, $.proxy(function () {
					this._fireCustomEvent("hide");
				}, this));
			}
		},
		
		/**
		 *  Determine whether or not the dropdown is currently visible to the user.
         *  @method isVisible
		 *  @returns {Boolean} : Is the dropdown currently visible? 
		 */
		isVisible: function () {
			try {
				return this.elements.root.is(":visible");
			} catch (e) {
				return false;
			}
		},
		
		/**
		 *  Given an HTML string or a DOM fragment, write/render that content inside the dropdown.
		 *  @method render
		 *  @param {String|HTMLElement[]} content : Content to be written to the content area of the dropdown.
		 *  @param {Boolean} isAppend : If TRUE, existing content will be appended to.
         *              Otherwise, existing content will be overwritten with new content.
		 *  @returns {Boolean} : Was content successfully written?
		 */
		render: function (content, isAppend) {
			if (content) {
				if (!isAppend) this.clear(); // by default, clear existing content
				$(this.elements.content).append(content);
				this._fireCustomEvent("render");
				return true;
			}
			return false;
		},
		
		/**
		 *  Public alias for "_setPosition" method. Repositions the dropdown in its default position beneath 
         *  the catalyst element.
		 *  @method setPosition
		 */
		setPosition: function () {
			this._setPosition();
		},
		
		/**
		 *  Alter the dropdown's default positioning with relative offset values.
		 *  @method setPositionOffset
		 *  @param {Integer} x : Number of pixels to offset on x-axis. Can be a negative value.
		 *  @param {Integer} y : Number of pixels to offset on y-axis. Can be a negative value.
		 */
		setPositionOffset: function (x, y) {
			if ($.isNumeric(x)) {
				this.positionOffset.x = x;
			}
			if ($.isNumeric(y)) {
				this.positionOffset.y = y;
			}
		},
		
		/**
		 *  Make the dropdown UI visible.
		 *  @method show
		 */
		show: function () {
			this.setPosition();
			this._fireCustomEvent("beforeShow");
			this.catalyst.addClass(this.catalystActiveClass);
			$(this.elements.root).fadeIn(this.fadeEffectDuration, $.proxy(function () {
				this._fireCustomEvent("show");
			}, this));
		},
		
		/**
		 *  Subscribe to custom event.
		 *  @method subscribe
		 *  @param {String} eventName : Name of the custom event to listen to. This event will be 
         *              automatically namespaced.
		 *  @param {Function} callback : Callback function to be executed if the event of interest occurs.
		 *  @param {Boolean} once : If TRUE, this event can only ever be triggered once.
		 *  @returns {Boolean} : Was this event successfully subscribed to?
		 */
		subscribe: function (eventName, callback, once) {
			if (typeof eventName === "string" && $.isFunction(callback)) {
				this.catalyst[(once === true) ? "one" : "on"](this._getEventName(eventName), callback);
				return true; // success
			}
			return false; // failure
		},
		
		/**
		 *  Toggle show/hide of the dropdown. Delegates to the private equivalent ("_toggle").
		 *  @method toggle
		 *  @returns {Boolean} : If TRUE, the dropdown was just made visible. Otherwise, the dropdown was just 
         *              made invisible.
		 */
		toggle: function () {
			return this._toggle();
		},
		
		/**
		 *  Unsubscribe from custom event.
		 *  @method unsubscribe
		 *  @param {String} eventName : Name of the custom event to unsubscribe from.
		 *  @param {Function} callback : The callback function supplied at subscription time. If no callback is specified, all listeners to this event will be unsubscribed. 
		 *  @returns {Boolean} : Was this event successfully unsubscribed from?
		 */
		unsubscribe: function (eventName, callback) {
			if (typeof eventName === "string") {
				this.catalyst.off(this._getEventName(eventName), callback);
				return true; // probable success (we don't really know if the listener was removed)
			}
			return false; // probable failure
		},
		
		/********************************************************************************************
		 * 
		 * 	Private Methods (pseudo-private)
		 * 
		 ********************************************************************************************/
		
		/**
		 *  Parse the configuration object and apply changes for this instance.
		 *  Intended to be run only once during initialization.
		 *  @method _applyConfiguration
		 *  @param {HashMap} config : Configuration object.
		 *  @private
		 */
		_applyConfiguration: function (config) {
			if ($.isPlainObject(config)) {
				
				// Input validation helper.
				var isString = function (str) {
					return (typeof str === "string" && !(/^\s*$/).test(str));
				};
				
				// Change anchor point?
				if (isString(config.anchorPoint)) {
					this.anchorPoint = config.anchorPoint;
				}
				
				// Add custom class name to the dropdown root?
				if (isString(config.className)) {
					this.customClassName = config.className;
				}
				
				// Add custom class name to catalyst whenever dropdown is visible?
				if (isString(config.catalystActiveClass)) {
					this.catalystActiveClass = config.catalystActiveClass
				}
				
				// Custom duration for the "hide" timeout?
				if ($.isNumeric(config.hideDelay)) {
					this.hideDelay = config.hideDelay > 0 ? config.hideDelay : 0; 
				}
				
				// Custom fade-in duration for show operation? Overrides the default.
				if ($.isNumeric(config.fadeEffectDuration) || config.fadeEffectDuration === false) {
					this.fadeEffectDuration = config.fadeEffectDuration;
				}
				
				// Disable mouse boundary detection? If set to FALSE, this effectively makes the dropdown 
                // "click-to-hide".
				this.isMouseBoundaryDetectionEnabled = !(config.mouseBoundaryDetectionEnabled === false);
				
				// Enable manual visibility toggling? If true, this effectively disables the 
                // "_initializeCatalyst" method.
				this.isManualShowEnabled = (config.manualShowEnabled === true)

			}
		},
		
		/**
		 *  Construct DOM skeleton for this dropdown. This is meant to be a one-time operation called during 
         *  initialization.
		 *  @method _buildStructure
		 *  @private
		 */
		_buildStructure: function () {
			
			// Private utility that creates namespaced CSS class names.
			var cn = $.proxy(function (className) {
				var str = this.namespace.css;
				if (typeof className === "string") {
					str += "-" + className.replace(/\s+/, "-");
				}
				return str;
			}, this);
			
			// Construct DOM skeleton.
			var rootEl = $("<div/>").addClass(cn()).hide(); // ensure these elements are hidden
			if (this.customClassName) { // if a custom class name was specified for this instance, add it now
				rootEl.addClass(this.customClassName);
			}
			var contentEl = $("<div/>").addClass(cn("content")).appendTo(rootEl);
			rootEl.appendTo(document.body);

			// Cache references to important DOM elements.
			$.extend(this.elements, {
				root: 		rootEl,
				content: 	contentEl
			});
		},
		
		/**
		 *  Define internal methods for how to position the dropdown with respect to the catalyst.
         *  The "strategy" will be chosen based on the anchor point (e.g. "left below").
		 *  @method _defineAnchorPointStrategies
		 *  @private
		 */
		_defineAnchorPointStrategies: function () {
			if (!this.anchorPointStrategies) {
				this.anchorPointStrategies = {
					// TO-DO: Does the "above" positioning actually work? Still untested.
					/*
					"above":    $.proxy(function () {
                                    var catalystPosition = this._getCatalystPosition();
                                    return {
                                        "bottom":	parseInt($(document).height() - ((0 - this.positionOffset.y) + catalystPosition.y + catalystPosition.h), 10) + "px",
                                        "top": 		"auto"
                                    };
                                }, this),
                    */
                    "below":    $.proxy(function () {
                                    var catalystPosition = this._getCatalystPosition();
                                    return {
                                        "top":		parseInt(this.positionOffset.y + catalystPosition.y + catalystPosition.h, 10) + "px",
                                        "bottom":	"auto"
                                    };
                                }, this),
                    "left":     $.proxy(function () {
                                    var catalystPosition = this._getCatalystPosition();
                                    return {
                                        "left":		parseInt(this.positionOffset.x + catalystPosition.x, 10) + "px",
                                        "right":	"auto"
                                    };
                                }, this),
                    "right":    $.proxy(function () {
                                    var catalystPosition = this._getCatalystPosition();
                                    return {
                                        "right":	parseInt($(window).width() - ((0 - this.positionOffset.x) + catalystPosition.x + catalystPosition.w), 10) + "px",
                                        "left":		"auto"
                                    };
                                }, this)
                };
            }
        },
		
		/**
		 *  Trigger/fire custom event. A reference to this instance will be supplied as an argument to the callback.
		 *  @method _fireCustomEvent
		 *  @param {String} eventName : Name of the event to fire.
		 *  @private
		 */
		_fireCustomEvent: function (eventName) {
			this.catalyst.trigger(this._getEventName(eventName), this); // supply ref to this instance to the callback
		},
		
		/**
		 *  Get catalyst element position and dimension information. Note: position is relative to the document.
		 *  @method _getCatalystPosition
		 *  @private
		 */
		_getCatalystPosition: function () {
			var catalyst = this.catalyst;
			var pos = catalyst.offset();
			return {
				x: Math.round(pos.left),
				y: Math.round(pos.top),
				// Explicitly supply FALSE to jQuery's "outerWidth" and "outerHeight" methods.
                // Otherwise, these methods are prone to incorrect behavior when used in a document with a 
                // mismatched/older version of jQueryUI.
				// See http://bugs.jquery.com/ticket/12491 for bug report.
				w: Math.round(catalyst.outerWidth(false)),
				h: Math.round(catalyst.outerHeight(false))
			};
		},
		
		/**
		 *  Internal utility. Given an event name, return it with a namespace suffix (for use with jQuery event binding).
		 *  @method _getEventName
		 *  @param {String} eventName : Event name to be namespaced.
		 *  @returns {String} : Event name with namespace, or NULL if bad argument supplied.
		 *  @private
		 */
		_getEventName: function (eventName) {
			return (typeof eventName === "string" || $.isArray(eventName)) ? eventName + "." + this.namespace.event : null;
		},
		
		/**
		 *  Internal utility. Given an array of event names, return them with namespace suffixes 
         *  (for use with jQuery event binding).
		 *  @method _getEventNames
		 *  @param {String[]} eventNames : Event names to be namespaced.
		 *  @returns {String[]} : Event names with namespace, or NULL if had argument supplied.
		 */
		_getEventNames: function (eventNames) {
			if (eventNames) {
				if (typeof eventNames === "string") {
					eventNames = [eventNames];
				}
				$.each(eventNames, $.proxy(function (index, eventName) {
					eventNames[index] = this._getEventName(eventName);
				}, this));
			}
			return (eventNames && eventNames.length) ? eventNames : null;
		},
		
		/**
		 *  Given an anchor point strategy, determine the positioning of the dropdown with respect to the catalyst. 
		 *  @method _getPositionByAnchorPoint
		 *  @returns {HashMap} : Object containing CSS positioning information, designed to be directly applied
         *              to an element via jQuery.
		 *  @private
		 */
		_getPositionByAnchorPoint: function () {
			
			// Transform anchor point string into an array of strings so each dimension can be processed individually.
			var strategies = this.anchorPoint.split(" ");
			if (strategies.length !== 2) {
				this._throwError("anchor point is invalid");
			}
			
			// Generate CSS positioning information based on anchor point strategy.
			var css = {};
			$.each(strategies, $.proxy(function (index, strategy) {
				$.extend(css, this.anchorPointStrategies[strategy]());
			}, this));
			
			if ($.isEmptyObject(css)) {
				this._throwError("could not determine dropdown position from anchor point");
			}
			return css;
		},
		
		/**
		 *  @method _getUniqueId
		 *  @private
		 */
		_getUniqueId: function () {
			if (!$.isNumeric(this.uniqueId)) {
				this.uniqueId = parseInt(Math.random().toString().replace(".", ""), 10);
			}
			return this.uniqueId;
		},
		
		/**
		 *  Various one-time initialization.
		 *  @method _initialize
		 *  @param {HashMap} config : Configuration object (from the constructor arguments).
		 *  @private
		 */
		_initialize: function (config) {
			
			// Append unique suffix to event namespace. Allows events to be (un)registered that are specific 
            // to this instance.
			var uniqueId = this._getUniqueId();
			this.namespace.event += uniqueId;
			
			// Apply configuration object to this instance.
			this._applyConfiguration(config);
			
			// Construct DOM skeleton for this dropdown.
			this._buildStructure();
			
			// Add data attributes to the catalyst and dropdown root elements, indicating which instance ID
            // they're associated with. This is currently only used for debugging.
			$(this.catalyst).add(this.elements.root).data("module-dropdown-id", uniqueId);
			
			// Establish event listeners on the catalyst element. This functionality is the primary decider 
            // regarding visibility toggling of the dropdown.
			this._initializeCatalyst();

			// Initialize event listeners for hiding the dropdown based on mouse cursor position.
			this._initializeMouseBoundaryDetection();
			
			// Defines internal functions for how to position the dropdown based on an anchor point strategy 
            // (e.g. "left below").
			this._defineAnchorPointStrategies();
			
			// Browser viewport resize should hide the dropdown if it's currently visible.
			$(window).on(this._getEventName("resize"), $.proxy(function () {
				if (this.isVisible()) {
					this._fireCustomEvent("hideAfterResize"); // differentiate this "hide" event as the result of a browser viewport resize
					this.hide();
				}
			}, this));
			
			/*
			 *  Clicks outside the dropdown should hide it. Required conditions:
			 *      1) The dropdown is currently visible.
			 *      2) The click did not originate from our catalyst (or any of its children).
			 *      3) The click did not originate from the dropdown itself (or any of its children).
			 */
			$(document.body).on(this._getEventName("click"), $.proxy(function (ev) {
				var $evTarget = $(ev.target);
				if (this.isVisible() && !($evTarget.closest(this.catalyst).length || $evTarget.closest("." + this.namespace.css).length)) {
					this.hide();
				}
			}, this));
			
			// Notify any interested parties that this dropdown instance has been initialized.
			this._fireCustomEvent("initialize");
		},
		
		/**
		 *  Establish event listeners on the catalyst for toggling visibility of the dropdown based on user interaction.
		 *  @method _initializeCatalyst 
		 *  @private
		 */
		_initializeCatalyst: function () {
			if (!this.isManualShowEnabled && !this.isMouseDelayedShowEnabled) {
				this.catalyst.on(this._getEventName("click"), $.proxy(function (ev) {
					if (ev) ev.preventDefault();
					this._toggle();
				}, this));
			}
		},
		
		/**
		 *  @method _initializeMouseBoundaryDetection
		 *  @private
		 */
		_initializeMouseBoundaryDetection: function () {
			
			if (this.isMouseBoundaryDetectionEnabled) {
				this.elements.root
					.on(this._getEventName("mouseenter"), $.proxy(function () {
						this._setMouseCursorInsideDropdown(true); // Record that the user has moused-into the dropdown.
					}, this))
					.on(this._getEventName("mouseleave"), $.proxy(function () {
						// Record that the user has moused-out of the dropdown.
						// This is important when dealing with delayed hiding of the dropdown. If the user quickly 
                        // cycles between mouseleave and mouseenter within a certain timeframe (this.hideDelay), 
                        // we want to keep the dropdown visible. 
						this._setMouseCursorInsideDropdown(false);
						
						// If there isn't already an active timeout and the dropdown is currently visible, 
                        // wait a little bit before hiding the dropdown...
						if (!this.hideTimer && this.isVisible()) {
							this.hideTimer = setTimeout($.proxy(function () {
								if (!this.isMouseCursorInsideDropdown) { // ensure user has not moused back into the dropdown
									this.hide();
								}
								this.cancelHide();
							}, this), this.hideDelay);
						}
					}, this));
			}
			
		},
		
		/**
		 *  Sets the "isMouseCursorInsideDropdown" property and notifies subscribers of the change.
		 *  @method _setMouseCursorInsideDropdown
		 *  @param {Boolean} isInside : Is the mouse cursor currently inside the dropdown wrapper?
		 *  @private
		 */
		_setMouseCursorInsideDropdown: function (isInside) {
			if (isInside) {
				this.isMouseCursorInsideDropdown = true;
				this._fireCustomEvent("mouseEnterDropdown");
			} else {
				this.isMouseCursorInsideDropdown = false;
				this._fireCustomEvent("mouseLeaveDropdown");
			}
		},
		
		/**
		 *  Sets the position of the dropdown with respect to the catalyst element.
		 *  @method _setPosition
		 *  @private
		 */
		_setPosition: function () {
			this.elements.root.css(this._getPositionByAnchorPoint());
			this._fireCustomEvent("position");
		},
		
		/**
		 *  Custom error handling.
		 *  @method _throwError
		 *  @param {String} message : Error message to show.
		 *  @private
		 */
		_throwError: function (message) {
			console.log("Dropdown Widget : " + (message || "unknown error"));
		},
		
		/**
		 *  Toggle show/hide of the dropdown.
		 *  @method _toggle
		 *  @returns {Boolean} : If TRUE, the dropdown was just made visible. Otherwise, the dropdown was 
         *              just made invisible.
		 *  @private
		 */
		_toggle: function () {
			if (this.isVisible()) {
				this.hide();
				return false;
			} else {
				this.show();
				return true;
			}
		}
			
	};
	
	/*
	 *  Exports
	 */
	return Dropdown;
	
});
