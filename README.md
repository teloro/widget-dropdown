Dropdown Widget
===============

### Brief Description
Custom dropdown menu widget. Depends on jQuery (but it's not a plugin).

### Description
This is a generic dropdown widget designed for flexibility. This widget spawns a floating layer that, 
by default, is positioned relative to the element (catalyst) that spawned it. In other words, unless 
the default positioning behavior of this widget is altered, this dropdown menu will be positioned just 
beneath and left-aligned with the element that triggered it.

This widget is observable via pub-sub events, and various behaviors can be altered or overwritten for 
whatever specific UI situation you're dealing with.

Also, this widget doesn't care where its content comes from. Use the public "render" method to write 
an HTML string to the content area.

### Example Usage
```javascript
  var myButton = $("#my-button-catalyst");
  var myDropdown = 
    new Dropdown(myButton, {
        className: "sean_connery",  // optional
        fadeEffectDuration: 500,    // optional
        anchorPoint: "right below"  // optional
    });
  myDropdown.render("Hello world!");
```

### Arguments
- {HTMLElement} catalyst : The catalyst element. Interacting with this element (e.g. via "click") will spawn the dropdown. Interaction is configurable.
- {HashMap} config : Configuration object...
  - {String} anchorPoint : Change the default anchor point of the dropdown. Accepted values: "left below" (default), "right below".
  - {String} className : Custom class name(s) to be applied to the root dropdown element.
  - {String} catalystActiveClass : Custom class name(s) to be applied to the catalyst element whenever the dropdown is visible.
  - {Integer} fadeEffectDuration : Duration of fade-in effect for show operation (in ms).
  - {Integer} hideDelay : Duration to wait after a hide-trigger occurs before actually hiding the dropdown (in ms).
  - {Boolean} manualShowEnabled : If TRUE, clicks on the catalyst will NOT toggle dropdown visibility. All "show" operations will need to be handled manually by you. (default: false)
  - {Boolean} mouseBoundaryDetectionEnabled : If FALSE, the dropdown can only be hidden by clicks. It will ignore mouseenter/mouseleave when evaluating whether or not to hide itself. (default: true)

### Custom Events
- beforeHide
- beforeShow
- destroy
- hide
- hideAfterResize
- initialize
- mouseEnterDropdown
- mouseLeaveDropdown
- position
- render
- show
