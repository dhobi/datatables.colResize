**This branch is compatible with DataTables 1.x only. For the current version use [this branch](https://github.com/dhobi/datatables.colResize/tree/master).**

# jQuery dataTables ColResize

Plugin to resize columns by mouse drag or touch.

## Demo:
https://dhobi.github.io/datatables.colResize/

## Installation:

**As npm package:**

```
npm i datatables.net-colresize-unofficial
```

**Manually**:

Javascript file to include: 
[jquery.dataTables.colResize.js](jquery.dataTables.colResize.js)

Stylesheet to include: 
[jquery.dataTables.colResize.css](jquery.dataTables.colResize.css)

**With CDN links:**

```
https://cdn.jsdelivr.net/npm/datatables.net-colresize-unofficial@latest/jquery.dataTables.colResize.css
```
```
https://cdn.jsdelivr.net/npm/datatables.net-colresize-unofficial@latest/jquery.dataTables.colResize.js
```

## Usage:

The plugin will try to initialize itself on preInit.dt event.

```javascript
var options = { ...see below... };
// Either:
var table = $('#example').DataTable({
    colResize: options
});

// Or:
var table = $('#example').DataTable();
new $.fn.dataTable.ColResize(table, options);

// Available methods:
table.colResize.enable();  // enable plugin (i.e. when options was isEnabled: false)
table.colResize.disable(); // remove all events
table.colResize.reset();   // reset column.sWidth values
table.colResize.save();    // save the current state (defaults to localstorage)
table.colResize.restore(); // restore the state from storage (defaults to localstorage)
```



## Options:
```javascript
colResize = {
    isEnabled: true,
    saveState: false,
    hoverClass: 'dt-colresizable-hover',
    hasBoundCheck: true,
    minBoundClass: 'dt-colresizable-bound-min',
    maxBoundClass: 'dt-colresizable-bound-max',
    isResizable: function (column) {
        return true;
    },
    onResizeStart: function (column, columns) {
    },
    onResize: function (column) {
    },
    onResizeEnd: function (column, columns) {
    },
    getMinWidthOf: function ($thNode) {
    },
    stateSaveCallback: function (settings, data) {
    },
    stateLoadCallback: function (settings) {
    }
}
```

### isEnabled

default: true

Specify whether resize functionality is enabled on dataTable init

### saveState

default false

Specify whether state should automatically save when changed and restore on page load

### hoverClass

default: 'dt-colresizable-hover'

Class which will be toggled on resizable & hovered \<th\> element (right border +/- 10px)

### hasBoundCheck

default: true

Specify whether min-width / max-width styles are checked to keep resizing of column in bounds

### minBoundClass
default: 'dt-colresizable-bound-min'

Class which will be toggled for 500ms once the min-width of the column has been reached

### maxBoundClass
default: 'dt-colresizable-bound-max'

Class which will be toggled for 500ms once the max-width of the column has been reached

### isResizable
default: column.isResizable / true

Called once during plugin/datatable init. Return false will not attach the drag events to the column.

### onResizeStart
Callback on drag start / touchstart event. Parameter is the dataTable column which has been resized and all other columns in the table.

### onResize
Callback on dragging / touchmove event. Parameter is the dataTable column which is currently being resized.

### onResizeEnd
Callback on drag end / touchend event. Parameter is the dataTable column which has been resized and all other columns in the table.

### getMinWidthOf

default: null

If defined (not null) will be used to calculate the minimal width of the given jQuery th - node.

If null (default) the plugin tries to detect the minimal width by

1. Looking at the CSS min-width property
2. Guessing the width by checking the space the text label uses
3. Minimum 30px width

### stateSaveCallback

default: uses localStorage

Callback when state needs to save. Parameter is an array of column sizes.

example: [437,412,416,258,397,357]

### stateLoadCallback

default: uses localStorage

Callback when state needs to be restored. You will need to return an array of column sizes.

example: [437,412,416,258,397,357]
