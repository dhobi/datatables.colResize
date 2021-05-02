# jQuery dataTables ColResize

Plugin to resize columns by mouse drag or touch.

## Demo:
http://live.datatables.net/hafazixi/8/edit?css,js,output

## Installation:
javascript file: jquery.dataTables.colResize.js

stylesheet to include: jquery.dataTables.colResize.css

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
table.colResize.enable(); // enable plugin (i.e. when options was isEnabled: false)
table.colResize.disable(); // remove all events
table.colResize.reset(); // reset column.sWidth values
```



## Options:
```javascript
colResize = {
  isEnabled: true,
  hoverClass: 'dt-colresizable-hover',
  hasBoundCheck: true,
  minBoundClass: 'dt-colresizable-bound-min',
  maxBoundClass: 'dt-colresizable-bound-max',
  isResizable: function(column) { return true; },
  onResize: function(column) {},
  onResizeEnd: function(column, columns) {},
  getMinWidthOf: function($thNode) {}
}
```

### isEnabled 
default: true

Specify whether resize functionality is enabled on dataTable init

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
