/**
 * @summary     ColResize
 * @description Provide the ability to resize columns in a DataTable
 * @version     1.0.0
 * @file        jquery.dataTables.colResize.js
 * @author      Daniel Hobi
 *
 * Language:    Javascript
 * License:     MIT
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery', 'datatables.net'], function ($) {
            return factory($, window, document);
        });
    }
    else if (typeof exports === 'object') {
        // CommonJS
        module.exports = function (root, $) {
            if (!root) {
                root = window;
            }

            if (!$ || !$.fn.dataTable) {
                $ = require('datatables.net')(root, $).$;
            }

            return factory($, root, root.document);
        };
    }
    else {
        // Browser
        factory(jQuery, window, document);
    }
}(function ($, window, document) {
    'use strict';
    function settingsFallback(userSetting, fallBackSetting) {
        var resultObject = {};
        for(var prop in fallBackSetting) {
            if(!fallBackSetting.hasOwnProperty(prop)) {
                continue;
            }
            if(userSetting.hasOwnProperty(prop)) {
                var userObject = userSetting[prop];
                if(typeof userObject === 'object') {
                    resultObject[prop] = settingsFallback(userObject, fallBackSetting[prop]);
                } else {
                    resultObject[prop] = userObject;
                }
            } else {
                resultObject[prop] = fallBackSetting[prop];
            }
        }
        return resultObject;
    }
    
    var DataTable = $.fn.dataTable;

    /**
     * ColResize provides column resizable control for DataTables
     * @class ColResize
     * @constructor
     * @param {object} dt DataTables settings object
     * @param {object} opts ColResize options
     */
    var ColResize = function(dt, opts) {
        opts = settingsFallback(opts || {}, ColResize.defaults);
        
        var settings = new $.fn.dataTable.Api(dt).settings()[0];
        dt = settings;

        // Ensure that we can't initialise on the same table twice
        if (settings._colResize) {
            return settings._colResize;
        }

        // Convert from camelCase to Hungarian, just as DataTables does
        var camelToHungarian = $.fn.dataTable.camelToHungarian;
        if (camelToHungarian) {
            camelToHungarian(ColResize.defaults, ColResize.defaults, true);
            camelToHungarian(ColResize.defaults, opts || {});
        }
        this.s = {
            dt: dt,
            state: {
                isDragging: false,
                startX: 0,
                originalWidth: 0,
                minWidth: 0,
                maxWidth: 0,
                $element: null,
                column: null,
                minBoundAllowClass: true,
                maxBoundAllowClass: true,
                isLastColumnDragging: false
            },
            opts: opts
        };
        this.s.dt._colResize = this;
        if(this.s.opts.isEnabled) {
            this._fnConstruct();
        }
        
        return this;
    };

    $.extend(ColResize.prototype, {
        fnEnable: function() {
            if(this.isEnabled) {
                this.s.dt.oInstance.oApi._fnLog(this.dt, 1, "ColResize attempted to enable again. Ignoring.");
                return;
            }
            this._fnConstruct();
        },
        fnReset: function() {
            this._fnGetAllColumns().forEach(function(column) {
                column.width = column._sResizableWidth;
                column.sWidth = column._sResizableWidth;
            });
            this.s.opts.onResizeEnd(null, this._fnGetAllColumns().map(this._fnMapColumn));
        },
        fnDisable: function() {
            if(!this.isEnabled) {
                this.s.dt.oInstance.oApi._fnLog(this.dt, 1, "ColResize attempted to disable again. Ignoring.");
                return;
            }
            
            $(document).off('.ColResize');
            this._fnGetAllColumns().forEach(function(column) {
                var $columnNode = $(column.nTh);
                $columnNode.off('.ColResize');
                $columnNode.removeAttr('data-is-resizable');
            });
            this.isEnabled = false;
        },
        /**
         * Constructor logic
         *  @method  _fnConstruct
         *  @returns void
         *  @private
         */
        _fnConstruct: function () {
            var that = this;

            // register document events
            $(document).on('mousemove.ColResize touchmove.ColResize', function(e) {
                if(that.s.state.isDragging) {
                    var changedWidth = that._fnGetXCoords(e) - that.s.state.startX;
                    that._fnApplyWidth(changedWidth);

                    that.s.opts.onResize(that._fnMapColumn(that.s.state.column));

                    //scroll if the last element gets resized
                    if(that.s.state.isLastColumnDragging) {
                        var $scrollBody = that._fnGetBodyScroll();
                        if($scrollBody.length > 0) {
                            $scrollBody[0].scrollLeft = $scrollBody[0].scrollWidth;
                        }
                    }
                }
            });
            $(document).on('mouseup.ColResize touchend.ColResize', function() {
                if(that.s.state.isDragging) {
                    // workaround to prevent sorting on column click
                    setTimeout(function() {
                        //disable sorting
                        that._fnGetAllColumns().forEach(function(column) {
                            column.bSortable = column._bSortableTempHolder;
                        });
                    }, 100);
                    // callback
                    var mappedColumns = that._fnGetAllColumns().map(that._fnMapColumn);
                    that.s.opts.onResizeEnd(that._fnMapColumn(that.s.state.column), mappedColumns);
                }
                that._fnGetAllColumns().forEach(function(column) {
                    $(column.nTh).removeClass(that.s.opts.hoverClass);
                });
                that.s.state.isDragging = false;
            });
            
            //register column events
                        
            this._fnGetAllColumns().forEach(function(column) {
                var $columnNode = $(column.nTh);
                var isResizable = that._fnIsColumnResizable(column);
                $columnNode.attr('data-is-resizable', isResizable.toString());
                if(isResizable) {
                    
                    //save the original value (server) somewhere
                    column._sResizableWidth = column.sWidth;
                    
                    $columnNode.on('mousemove.ColResize touchmove.ColResize', function(e) {
                        var $node = $(e.currentTarget);
                        if(that._fnIsInDragArea($node, e)) {
                            $node.addClass(that.s.opts.hoverClass);
                        } else {
                            if(!that.s.state.isDragging) {
                                $node.removeClass(that.s.opts.hoverClass);
                            }
                        }
                    });
                    $columnNode.on('mouseout.ColResize', function(e) {
                        if(!that.s.state.isDragging) {
                            var $node = $(e.currentTarget);
                            $node.removeClass(that.s.opts.hoverClass);
                        }
                    });
                    $columnNode.on('mousedown.ColResize touchstart.ColResize', function(e) {
                        var $node = $(e.currentTarget);
                        if(that._fnIsInDragArea($node, e)) {
                            that.s.state.isDragging = true;
                            that.s.state.startX = that._fnGetXCoords(e);
                            that.s.state.originalWidth = $node.outerWidth();
                            that.s.state.minWidth = that._fnGetWidthOfValue($node.css('min-width'));
                            that.s.state.maxWidth = that._fnGetWidthOfValue($node.css('max-width'));
                            that.s.state.minBoundAllowClass = true;
                            that.s.state.maxBoundAllowClass = true;
                            that.s.state.$element = $node;
                            that.s.state.column = column;
                            that.s.state.isLastColumnDragging = that._fnIsLastResizableColumnDragging(column);
                            
                            //disable sorting
                            that._fnGetAllColumns().forEach(function(column) {
                                column._bSortableTempHolder = column.bSortable;
                                column.bSortable = false;
                            });
                            that.s.opts.onResizeStart(null, that._fnGetAllColumns().map(that._fnMapColumn));
                        }
                    });
                }
            });
            
            this.isEnabled = true;
        },
        _fnGetAllColumns: function() {
            return this.s.dt.aoColumns;
        },
        _fnGetBodyScroll: function() {
            return $(this.s.dt.nScrollBody);
        },
        _fnIsInDragArea: function($th, e) {
            var rightSide = $th.offset().left + $th.outerWidth();
            var xCoord = this._fnGetXCoords(e);
            return (rightSide + 10) > xCoord && (rightSide - 10) < xCoord;
        },
        _fnGetXCoords(e) {
            return e.type.indexOf('touch') !== -1 ? e.originalEvent.touches[0].pageX : e.pageX;
        },
        _fnApplyWidth: function(changedWidth) {
            var that = this;
            //keep inside bounds by manipulating changedWidth if any
            changedWidth = this.s.opts.hasBoundCheck ? this._fnBoundCheck(changedWidth) : changedWidth;
            
            //apply widths
            var thWidth = this.s.state.originalWidth + changedWidth;
            this._fnApplyWidthColumn(this.s.state.column, thWidth);

            //change table size
            var $table = this.s.state.$element.closest('table');
            var shouldChangeTableWidth = changedWidth < 0 && 
                this.s.state.$element.closest('.dataTables_scroll').length > 0 && 
                ($table.width() + changedWidth) > this.s.state.$element.closest('.dataTables_scroll').width();
            if(shouldChangeTableWidth) {
                $table.width($table.width() + changedWidth - 1);
            }
            
            var scrollBodyTh = this.s.state.$element.closest('.dataTables_scroll').find('.dataTables_scrollBody table th:nth-child('+(this.s.state.$element.index() + 1)+')');
            scrollBodyTh.outerWidth((thWidth)+'px');

            var $bodyTable = scrollBodyTh.closest('table');
            $bodyTable.width($table.width());

            // table has not shrunk, modify the width of all columns. 
            // HTML table can force columns to be wider than max-width and smaller than min-width. Overwrite style properties with !important to force it to look the same as the header
            if(changedWidth < 0 && 
                this.s.state.$element.closest('.dataTables_scroll').length > 0 && 
                ($table.width() + changedWidth) < this.s.state.$element.closest('.dataTables_scroll').width()) {
                this._fnGetAllColumns().forEach(function(column) {
                    var $hbTh = $(column.nTh);
                    var $sbTh = that.s.state.$element.closest('.dataTables_scroll').find('.dataTables_scrollBody table th:nth-child('+($hbTh.index() + 1)+')');
                    $sbTh.width($hbTh.width()+" !important");
                });
            }
        },
        _fnApplyWidthColumn: function(column, width) {
            $(column.nTh).outerWidth(width+'px');
            column.sWidth = width+'px';
        },
        _fnGetWidthOfValue: function(widthStr) {
            if(widthStr === 'none') {
                return -1;
            }
            return parseInt(widthStr.match(/(\d)+px/ig));
        },
        _fnBoundCheck: function(changedWidth) {
            var that = this;
            var thWishWidth = this.s.state.originalWidth + changedWidth;
            var $currentElement = null;
            
            //min bound
            if(this.s.state.minWidth !== -1 && thWishWidth < this.s.state.minWidth) {
                var addBackToMinWidth = this.s.state.minWidth - thWishWidth;
                changedWidth += addBackToMinWidth;
                if(this.s.state.minBoundAllowClass) {
                    this.s.state.$element.addClass(this.s.opts.minBoundClass);
                    $currentElement = this.s.state.$element;
                    setTimeout(function() { $currentElement.removeClass(that.s.opts.minBoundClass); }, 500);
                    this.s.state.minBoundAllowClass = false;
                }
            } else {
                this.s.state.minBoundAllowClass = true;
            }
            
            //max bound
            if(this.s.state.maxWidth !== -1 && thWishWidth > this.s.state.maxWidth) {
                var substractFromMaxWidth = thWishWidth - this.s.state.maxWidth;
                changedWidth -= substractFromMaxWidth;
                if(this.s.state.maxBoundAllowClass) {
                    this.s.state.$element.addClass(this.s.opts.maxBoundClass);
                    $currentElement = this.s.state.$element;
                    setTimeout(function() { $currentElement.removeClass(that.s.opts.maxBoundClass); }, 500);
                    this.s.state.maxBoundAllowClass = false;
                }
            } else {
                this.s.state.maxBoundAllowClass = true;
            }
            
            return changedWidth;
        },
        _fnMapColumn: function(column) {
            return { idx: column.idx, width: column.sWidth };
        },
        _fnIsLastResizableColumnDragging: function(draggingColumn) {
            var visibleColumns = this._fnGetAllColumns().filter(function(column) { return $(column.nTh).is(':visible'); });
            var indexOfColumn = visibleColumns.indexOf(draggingColumn);
            if(indexOfColumn === visibleColumns.length - 1) {
                return true;
            }
            for(var counter = indexOfColumn+1; counter < visibleColumns.length; counter++) {
                var column = visibleColumns[counter];
                if(this._fnIsColumnResizable(column)) {
                    return false;
                }
            }
            return true;
        },
        _fnIsColumnResizable: function(column) {
            return this.s.opts.isResizable(column);
        }
    });

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
	 * Static parameters
	 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */


    /**
     * ColResize default settings for initialisation
     *  @namespace
     *  @static
     */
    ColResize.defaults = {
        isEnabled: true,
        hoverClass: 'dt-colresizable-hover',
        hasBoundCheck: true,
        minBoundClass: 'dt-colresizable-bound-min',
        maxBoundClass: 'dt-colresizable-bound-max',
        isResizable: function(column) {
            if(typeof column.isResizable === 'undefined') {
                return true;
            }
            return column.isResizable;
        },
        onResizeStart: function(column, columns) {},
        onResize: function(column) {},
        onResizeEnd: function(column, columns) {}
    };
    
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
	 * Constants
	 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * ColResize version
     *  @constant  version
     *  @type      String
     *  @default   As code
     */
    ColResize.version = "1.0.0";

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
	 * DataTables interfaces
	 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    // Expose
    $.fn.dataTable.ColResize = ColResize;
    $.fn.DataTable.ColResize = ColResize;


    // Register a new feature with DataTables
    if (typeof $.fn.dataTable == "function" &&
        typeof $.fn.dataTableExt.fnVersionCheck == "function" &&
        $.fn.dataTableExt.fnVersionCheck('1.10.8')) {
        $.fn.dataTableExt.aoFeatures.push({
            "fnInit": function (settings) {
                var table = settings.oInstance;

                if (!settings._colResize) {
                    var init = settings.oInit.colResize;
                    var opts = $.extend({}, init, DataTable.defaults.colResize);
                    new ColResize(settings, opts);
                }
                else {
                    table.oApi._fnLog(settings, 1, "ColResize attempted to initialise twice. Ignoring second");
                }

                return null; /* No node for DataTables to insert */
            },
            "sFeature": "ColResize"
        });
    }
    else {
        alert("Warning: ColResize requires DataTables 1.10.8 or greater - www.datatables.net/download");
    }


    // Attach a listener to the document which listens for DataTables initialisation
    // events so we can automatically initialise
    $(document).on('preInit.dt.colResize', function (e, settings) {
        if (e.namespace !== 'dt') {
            return;
        }

        var init = settings.oInit.colResize;
        var defaults = DataTable.defaults.colResize;

        if (init || defaults) {
            var opts = $.extend({}, init, defaults);

            if (init !== false) {
                new ColResize(settings, opts);
            }
        }
    });

    // API augmentation
    $.fn.dataTable.Api.register('colResize.enable()', function () {
        return this.iterator('table', function (ctx) {
            ctx._colResize.fnEnable();
        });
    });
    $.fn.dataTable.Api.register('colResize.disable()', function () {
        return this.iterator('table', function (ctx) {
            ctx._colResize.fnDisable();
        });
    });
    $.fn.dataTable.Api.register('colResize.reset()', function () {
        return this.iterator('table', function (ctx) {
            ctx._colResize.fnReset();
        });
    });
}));