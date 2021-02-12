/**
 * @summary     ColResize
 * @description Provide the ability to resize columns in a DataTable
 * @version     1.6.1
 * @file        jquery.dataTables.colResize.js
 * @author      Daniel Hobi, Lado Tadic, Daniel Petras
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
                originalTableWidth: 0,
                originalWidth: 0,
                minWidth: 0,
                maxWidth: 0,
                $element: null,
                column: null,
                minBoundAllowClass: true,
                maxBoundAllowClass: true,
                isLastColumnDragging: false,
                maxTableWidth: 0,
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
                this.s.dt.oInstance.oApi._fnLog(this.dt, 1, "ColResize: attempted to enable again. Ignoring.");
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
                this.s.dt.oInstance.oApi._fnLog(this.dt, 1, "ColResize: attempted to disable again. Ignoring.");
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

                    // do not outgrow table if not scrollable
                    if(that.s.state.maxTableWidth > 0) {
                        var currentTableWidth = that.s.state.$element.closest('table').width();
                        if(currentTableWidth > that.s.state.maxTableWidth) {
                            that._fnApplyWidth(changedWidth + (that.s.state.maxTableWidth - currentTableWidth));
                            that._fnShowMaxBoundReached();
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
                            
                            //disable sorting
                            that._fnGetAllColumns().forEach(function(column) {
                                column._bSortableTempHolder = column.bSortable;
                                column.bSortable = false;
                                that._fnRemovePercentWidths(column, $(column.nTh));
                            });
                            
                            that.s.state.isDragging = true;
                            that.s.state.startX = that._fnGetXCoords(e);
                            that.s.state.maxTableWidth = that._fnGetBodyScroll().length > 0 ? 0 : $node.closest('table').width();
                            that.s.state.originalTableWidth = $node.closest('table').width();
                            that.s.state.originalWidth = that._fnGetCurrentWidth($node);
                            that.s.state.minWidth = that._fnGetMinWidthOf($node);
                            that.s.state.maxWidth = that._fnGetMaxWidthOf($node);
                            that.s.state.minBoundAllowClass = true;
                            that.s.state.maxBoundAllowClass = true;
                            that.s.state.$element = $node;
                            that.s.state.column = column;
                            that.s.state.isLastColumnDragging = that._fnIsLastResizableColumnDragging(column);
                            
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
        _fnRemovePercentWidths: function(column, $node) {
            if($node.attr('style') && $node.attr('style').indexOf('%') !== -1) {
                this.s.dt.oInstance.oApi._fnLog(this.dt, 1, "ColResize: column styles in percentages is not supported, trying to convert to px on the fly.");
                var width = $node.width();
                $node.removeAttr('style');
                column.sWidth = width+'px';
                column.width = width+'px';
                $node.width(width);
            } else {
                $node.width($node.width());
            }
        },
        _fnIsInDragArea: function($th, e) {
            var rightSide = $th.offset().left + $th.outerWidth();
            var xCoord = this._fnGetXCoords(e);
            return (rightSide + 10) > xCoord && (rightSide - 10) < xCoord;
        },
        _fnGetXCoords: function(e) {
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
            var shouldChangeTableWidth = this.s.state.$element.closest('.dataTables_scroll').length > 0 &&
                ($table.width() + changedWidth) > this.s.state.$element.closest('.dataTables_scroll').width();
            if(shouldChangeTableWidth) {
                $table.width(that.s.state.originalTableWidth + changedWidth);
            }

            // possible body table
            var scrollBodyTh = this.s.state.$element.closest('.dataTables_scroll').find('.dataTables_scrollBody table th:nth-child('+(this.s.state.$element.index() + 1)+')');
            scrollBodyTh.outerWidth((thWidth)+'px');
            var $bodyTable = scrollBodyTh.closest('table');
            $bodyTable.width($table.width());

            // possible footer table
            var scrollFooterTh = this.s.state.$element.closest('.dataTables_scroll').find('.dataTables_scrollFoot table th:nth-child('+(this.s.state.$element.index() + 1)+')');
            scrollFooterTh.outerWidth((thWidth)+'px');
            var $footerTable = scrollFooterTh.closest('table');
            $footerTable.width($table.width());
            
            // HTML table can force columns to be wider than max-width and smaller than min-width. Overwrite style properties to look the same as the header
            if(this.s.state.$element.closest('.dataTables_scroll').length > 0) { 
                var additionalStylesForHiddenThRows = ';padding-top: 0px;padding-bottom: 0px;border-top-width: 0px;border-bottom-width: 0px;height: 0px;';
                this._fnGetAllColumns().forEach(function(column) {
                    var $hbTh = $(column.nTh);
                    var currentIndex = $hbTh.index();
                    var currentStyles = $hbTh.attr('style') + additionalStylesForHiddenThRows;

                    //body table
                    var $sbTh = that.s.state.$element.closest('.dataTables_scroll').find('.dataTables_scrollBody table th:nth-child('+(currentIndex + 1)+')');
                    $sbTh.attr('style', currentStyles);
                    //footer table
                    var $sfTh = that.s.state.$element.closest('.dataTables_scroll').find('.dataTables_scrollFoot table th:nth-child('+(currentIndex + 1)+')');
                    $sfTh.attr('style', currentStyles);
                });
            }
        },
        _fnApplyWidthColumn: function(column, width) {
            $(column.nTh).outerWidth(width+'px');
            column.sWidth = width+'px';
        },
        _fnGetCurrentWidth: function($node) {
            var possibleWidths = $node.attr('style').split(';').map(function(cssPart) { return cssPart.trim(); })
                .filter(function(cssPart) { return cssPart !== ''; })
                .map(function(cssPart) {
                    var widthResult = cssPart.match(/^width: (\d+)px/i);
                    return widthResult != null ? parseInt(widthResult[1]) : 0;
                })
                .filter(function(possibleWidth) { return !isNaN(possibleWidth) && possibleWidth > 0; });

            if(possibleWidths.length > 0) {
                return possibleWidths[0];
            }
            return $node.width();
        },
        _fnGetMinWidthOf: function ($node) {
            if(this.s.opts.getMinWidthOf != null) {
                return this.s.opts.getMinWidthOf($node);
            }
            var minWidthFromCss = this._fnGetWidthOfValue($node.css('min-width'));
            if(!isNaN(minWidthFromCss) && minWidthFromCss > 0) {
                return minWidthFromCss;
            }

            //try to guess
            var $hiddenElement = $node.clone().css({ 
                left: -10000, 
                top: -10000, 
                position: 'absolute', 
                display: 'inline', 
                visibility: 'visible', 
                width: 'auto', 
                fontFamily: $node.css('font-family'), 
                fontSize: $node.css('font-size'),
                padding: $node.css('padding')
            }).appendTo('body');
            var minWidth = parseInt($hiddenElement.width());
            $hiddenElement.remove();
            if(!$node.hasClass('sorting_disabled')) {
                minWidth += 20; //sortable column needs a bit more space for the icon
            }
            return minWidth < 30 ? 30 : minWidth;
        },
        _fnGetMaxWidthOf: function($node) {
            return this._fnGetWidthOfValue($node.css('max-width'));
        },
        _fnGetWidthOfValue: function(widthStr) {
            if(widthStr === 'none') {
                return -1;
            }
            return parseInt(widthStr.match(/(\d+)px/ig));
        },
        _fnBoundCheck: function(changedWidth) {
            var thWishWidth = this.s.state.originalWidth + changedWidth;

            //min bound
            if(this.s.state.minWidth !== -1 && thWishWidth < this.s.state.minWidth) {
                var addBackToMinWidth = this.s.state.minWidth - thWishWidth;
                changedWidth += addBackToMinWidth;
                this._fnShowMinBoundReached();
            } else {
                this.s.state.minBoundAllowClass = true;
            }

            //max bound
            if(this.s.state.maxWidth !== -1 && thWishWidth > this.s.state.maxWidth) {
                var substractFromMaxWidth = thWishWidth - this.s.state.maxWidth;
                changedWidth -= substractFromMaxWidth;
                this._fnShowMaxBoundReached();
            } else {
                this.s.state.maxBoundAllowClass = true;
            }

            return changedWidth;
        },
        _fnShowMinBoundReached: function() {
            var that = this;
            if(this.s.state.minBoundAllowClass) {
                this.s.state.$element.addClass(this.s.opts.minBoundClass);
                var $currentElement = this.s.state.$element;
                setTimeout(function() { $currentElement.removeClass(that.s.opts.minBoundClass); }, 500);
                this.s.state.minBoundAllowClass = false;
            }
        },
        _fnShowMaxBoundReached: function() {
            var that = this;
            if(this.s.state.maxBoundAllowClass) {
                this.s.state.$element.addClass(this.s.opts.maxBoundClass);
                var $currentElement = this.s.state.$element;
                setTimeout(function() { $currentElement.removeClass(that.s.opts.maxBoundClass); }, 500);
                this.s.state.maxBoundAllowClass = false;
            }
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
        onResizeEnd: function (column, columns) { },
        getMinWidthOf: null
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
    ColResize.version = "1.6.1";

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
                    table.oApi._fnLog(settings, 1, "ColResize: attempted to initialise twice. Ignoring second");
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