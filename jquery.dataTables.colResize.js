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
  } else if (typeof exports === 'object') {
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
  } else {
    // Browser
    factory(jQuery, window, document);
  }
}(function ($, window, document) {
  'use strict';
  function settingsFallback (userSetting, fallBackSetting) {
    const resultObject = {};
    for (const prop in fallBackSetting) {
      if (!fallBackSetting.hasOwnProperty(prop)) {
        continue;
      }
      if (userSetting.hasOwnProperty(prop)) {
        const userObject = userSetting[prop];
        if (typeof userObject === 'object') {
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

  const DataTable = $.fn.dataTable;

  /**
   * ColResize provides column resizable control for DataTables
   * @class ColResize
   * @constructor
   * @param {object} dt DataTables settings object
   * @param {object} opts ColResize options
   */
  const ColResize = function (dt, opts) {
    opts = settingsFallback(opts || {}, ColResize.defaults);

    const settings = new $.fn.dataTable.Api(dt).settings()[0];
    dt = settings;

    // Ensure that we can't initialise on the same table twice
    if (settings._colResize) {
      return settings._colResize;
    }

    // Convert from camelCase to Hungarian, just as DataTables does
    const camelToHungarian = $.fn.dataTable.camelToHungarian;
    if (camelToHungarian) {
      camelToHungarian(ColResize.defaults, ColResize.defaults, true);
      camelToHungarian(ColResize.defaults, opts || {});
    }
    this.s = {
      dt,
      state: {
        isDragging: false,
        startX: 0,
        originalTableWidth: 0,
        originalWidth: [],
        minWidth: 0,
        maxWidth: 0,
        $element: null,
        column: null,
        minBoundAllowClass: true,
        maxBoundAllowClass: true,
        isLastColumnDragging: false,
        maxTableWidth: 0,
      },
      opts,
    };
    this.s.dt._colResize = this;
    if (this.s.opts.isEnabled) {
      this._fnConstruct();
    }

    return this;
  };

  $.extend(ColResize.prototype, {
    fnEnable: function () {
      if (this.isEnabled) {
        this.s.dt.oInstance.oApi._fnLog(this.dt, 1, 'ColResize: attempted to enable again. Ignoring.');
        return;
      }
      this._fnConstruct();
    },
    fnReset: function () {
      const self = this;
      this._fnGetAllColumns().forEach(function (column) {
        if (column.sWidth == null) {
          return;
        }

        const widthResult = column.sWidth.match(/(\d+)/i);
        const oldWidth = widthResult != null ? parseInt(widthResult[0]) : 0;
        const newWidthResult = column._sResizableWidth.match(/(\d+)/i);
        const newWidth = newWidthResult != null ? parseInt(newWidthResult[0]) : 0;
        const $node = $(column.nTh);

        self.s.state.originalWidth[$node.index()] = oldWidth;
        column.width = column._sResizableWidth;
        column.sWidth = column._sResizableWidth;
        self._fnApplyWidth(newWidth - oldWidth, $node, column);
      });
      this.s.opts.onResizeEnd(null, this._fnGetAllColumns().map(this._fnMapColumn));
    },
    fnRestoreState: function () {
      const self = this;
      const sizeMap = this.s.opts.stateLoadCallback(this.s.opts);
      const cols = this._fnGetAllColumns();
      if (sizeMap == null) {
        return;
      }

      if (sizeMap.length !== cols.length) {
        this.s.dt.oInstance.oApi._fnLog(this.dt, 1, 'ColResize: Array size doesn\'t match number of columns.');
        return;
      }

      self.s.state.maxTableWidth = self._fnGetBodyScroll().length > 0 ? 0 : this._fnGetTable().width();
      self.s.state.originalTableWidth = this._fnGetTable().width();

      cols.forEach(function (column) {
        if (column.sWidth == null) {
          return;
        }

        const widthResult = column.sWidth.match(/(\d+)/i);
        const oldWidth = widthResult != null ? parseInt(widthResult[0]) : 0;
        const newWidth = sizeMap[column.idx];
        const $node = $(column.nTh);

        self.s.state.originalWidth[$node.index()] = oldWidth;
        column.width = newWidth + 'px';
        column.sWidth = newWidth + 'px';
        self._fnApplyWidth(newWidth - oldWidth, $node, column);
      });
      this.s.opts.onResizeEnd(null, this._fnGetAllColumns().map(this._fnMapColumn));
    },
    fnSaveState: function () {
      const sizeMap = [];
      this._fnGetAllColumns().forEach(function (column) {
        sizeMap[column.idx] = column.nTh.offsetWidth;
      });
      this.s.opts.stateSaveCallback(this.s.opts, sizeMap);
    },
    fnDisable: function () {
      if (!this.isEnabled) {
        this.s.dt.oInstance.oApi._fnLog(this.dt, 1, 'ColResize: attempted to disable again. Ignoring.');
        return;
      }

      $(document).off('.ColResize');
      this._fnGetAllColumns().forEach(function (column) {
        const $columnNode = $(column.nTh);
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
      const self = this;

      // register document events
      $(document).on('mousemove.ColResize touchmove.ColResize', function (e) {
        if (self.s.state.isDragging) {
          const changedWidth = self._fnGetXCoords(e) - self.s.state.startX;
          self._fnApplyWidth(changedWidth, self.s.state.$element, self.s.state.column);

          self.s.opts.onResize(self._fnMapColumn(self.s.state.column));

          // scroll if the last element gets resized
          if (self.s.state.isLastColumnDragging) {
            const $scrollBody = self._fnGetBodyScroll();
            if ($scrollBody.length > 0) {
              $scrollBody[0].scrollLeft = $scrollBody[0].scrollWidth;
            }
          }

          // do not outgrow table if not scrollable
          if (self.s.state.maxTableWidth > 0) {
            const currentTableWidth = self.s.state.$element.closest('table').width();
            if (currentTableWidth > self.s.state.maxTableWidth) {
              self._fnApplyWidth(changedWidth + (self.s.state.maxTableWidth - currentTableWidth, self.s.state.$element, self.s.state.column));
              self._fnShowMaxBoundReached();
            }
          }
        }
      });
      $(document).on('mouseup.ColResize touchend.ColResize', function () {
        if (self.s.state.isDragging) {
          // workaround to prevent sorting on column click
          setTimeout(function () {
            // disable sorting
            self._fnGetAllColumns().forEach(function (column) {
              column.bSortable = column._bSortableTempHolder;
            });
          }, 100);
          // callback
          const mappedColumns = self._fnGetAllColumns().map(self._fnMapColumn);
          self.s.opts.onResizeEnd(self._fnMapColumn(self.s.state.column), mappedColumns);
          if (self.s.opts.saveState) {
            self.fnSaveState();
          }
        }
        self._fnGetAllColumns().forEach(function (column) {
          $(column.nTh).removeClass(self.s.opts.hoverClass);
        });
        self.s.state.isDragging = false;
      });

      // register column events

      this._fnGetAllColumns().forEach(function (column) {
        const $columnNode = $(column.nTh);
        const isResizable = self._fnIsColumnResizable(column);
        $columnNode.attr('data-is-resizable', isResizable.toString());
        // save the original value (server) somewhere, we want the size of all of them.
        column._sResizableWidth = column.sWidth;
        if (isResizable) {
          $columnNode.on('mousemove.ColResize touchmove.ColResize', function (e) {
            const $node = $(e.currentTarget);
            if (self._fnIsInDragArea($node, e)) {
              $node.addClass(self.s.opts.hoverClass);
            } else {
              if (!self.s.state.isDragging) {
                $node.removeClass(self.s.opts.hoverClass);
              }
            }
          });
          $columnNode.on('mouseout.ColResize', function (e) {
            if (!self.s.state.isDragging) {
              const $node = $(e.currentTarget);
              $node.removeClass(self.s.opts.hoverClass);
            }
          });
          $columnNode.on('mousedown.ColResize touchstart.ColResize', function (e) {
            const $node = $(e.currentTarget);
            if (self._fnIsInDragArea($node, e)) {
              // disable sorting
              self._fnGetAllColumns().forEach(function (column) {
                column._bSortableTempHolder = column.bSortable;
                column.bSortable = false;
                self._fnRemovePercentWidths(column, $(column.nTh));
              });

              self.s.state.isDragging = true;
              self.s.state.startX = self._fnGetXCoords(e);
              self.s.state.maxTableWidth = self._fnGetBodyScroll().length > 0 ? 0 : $node.closest('table').width();
              self.s.state.originalTableWidth = $node.closest('table').width();
              self.s.state.originalWidth[$node.index()] = self._fnGetCurrentWidth($node);
              self.s.state.minWidth = self._fnGetMinWidthOf($node);
              self.s.state.maxWidth = self._fnGetMaxWidthOf($node);
              self.s.state.minBoundAllowClass = true;
              self.s.state.maxBoundAllowClass = true;
              self.s.state.$element = $node;
              self.s.state.column = column;
              self.s.state.isLastColumnDragging = self._fnIsLastResizableColumnDragging(column);

              self.s.opts.onResizeStart(null, self._fnGetAllColumns().map(self._fnMapColumn));
            }
          });
        }
      });
      this.isEnabled = true;
      if (this.s.opts.saveState) {
        this.fnRestoreState();
      }
    },
    _fnGetAllColumns: function () {
      return this.s.dt.aoColumns;
    },
    _fnGetBodyScroll: function () {
      return $(this.s.dt.nScrollBody);
    },
    _fnGetTable: function () {
      return $(this.s.dt.nTable);
    },
    _fnRemovePercentWidths: function (column, $node) {
      if ($node.attr('style') && $node.attr('style').indexOf('%') !== -1) {
        this.s.dt.oInstance.oApi._fnLog(this.dt, 1, 'ColResize: column styles in percentages is not supported, trying to convert to px on the fly.');
        const width = $node.width();
        $node.removeAttr('style');
        column.sWidth = width + 'px';
        column.width = width + 'px';
        $node.width(width);
      } else {
        $node.width($node.width());
      }
    },
    _fnIsInDragArea: function ($th, e) {
      const rightSide = $th.offset().left + $th.outerWidth();
      const xCoord = this._fnGetXCoords(e);
      return rightSide + 10 > xCoord && rightSide - 10 < xCoord;
    },
    _fnGetXCoords: function (e) {
      return e.type.indexOf('touch') !== -1 ? e.originalEvent.touches[0].pageX : e.pageX;
    },
    _fnApplyWidth: function (changedWidth, element, column) {
      const self = this;
      // keep inside bounds by manipulating changedWidth if any
      changedWidth = this.s.opts.hasBoundCheck ? this._fnBoundCheck(changedWidth, element) : changedWidth;

      // apply widths
      const thWidth = this.s.state.originalWidth[element.index()] + changedWidth;
      this._fnApplyWidthColumn(column, thWidth);

      // change table size
      const $table = element.closest('table');
      const shouldChangeTableWidth = element.closest('.dataTables_scroll').length > 0 &&
                ($table.width() + changedWidth) > element.closest('.dataTables_scroll').width();
      if (shouldChangeTableWidth) {
        $table.width(self.s.state.originalTableWidth + changedWidth);
      }

      // possible body table
      const scrollBodyTh = element
        .closest('.dataTables_scroll')
        .find('.dataTables_scrollBody table th:nth-child(' + (element.index() + 1) + ')');
      scrollBodyTh.outerWidth(thWidth + 'px');
      const $bodyTable = scrollBodyTh.closest('table');
      $bodyTable.width($table.width());

      // possible footer table
      const scrollFooterTh = element
        .closest('.dataTables_scroll')
        .find('.dataTables_scrollFoot table th:nth-child(' + (element.index() + 1) + ')');
      scrollFooterTh.outerWidth(thWidth + 'px');
      const $footerTable = scrollFooterTh.closest('table');
      $footerTable.width($table.width());

      // HTML table can force columns to be wider than max-width and smaller than min-width. Overwrite style properties to look the same as the header
      if (element.closest('.dataTables_scroll').length > 0) {
        const additionalStylesForHiddenThRows = ';padding-top: 0px;padding-bottom: 0px;border-top-width: 0px;border-bottom-width: 0px;height: 0px;';
        this._fnGetAllColumns().forEach(function (column) {
          const $hbTh = $(column.nTh);
          const currentIndex = $hbTh.index();
          const currentStyles = $hbTh.attr('style') + additionalStylesForHiddenThRows;

          // body table
          const $sbTh = element
            .closest('.dataTables_scroll')
            .find('.dataTables_scrollBody table th:nth-child(' + (currentIndex + 1) + ')');
          $sbTh.attr('style', currentStyles);
          // footer table
          const $sfTh = element
            .closest('.dataTables_scroll')
            .find('.dataTables_scrollFoot table th:nth-child(' + (currentIndex + 1) + ')');
          $sfTh.attr('style', currentStyles);
        });
      }
    },
    _fnApplyWidthColumn: function (column, width) {
      $(column.nTh).outerWidth(width + 'px');
      column.sWidth = width + 'px';
    },
    _fnGetCurrentWidth: function ($node) {
      const possibleWidths = $node
        .attr('style')
        .split(';')
        .map(function (cssPart) {
          return cssPart.trim();
        })
        .filter(function (cssPart) {
          return cssPart !== '';
        })
        .map(function (cssPart) {
          const widthResult = cssPart.match(/^width: (\d+)px/i);
          return widthResult != null ? parseInt(widthResult[1]) : 0;
        })
        .filter(function (possibleWidth) {
          return !isNaN(possibleWidth) && possibleWidth > 0;
        });

      if (possibleWidths.length > 0) {
        return possibleWidths[0];
      }
      return $node.width();
    },
    _fnGetMinWidthOf: function ($node) {
      if (this.s.opts.getMinWidthOf != null) {
        return this.s.opts.getMinWidthOf($node);
      }
      const minWidthFromCss = this._fnGetWidthOfValue($node.css('min-width'));
      if (!isNaN(minWidthFromCss) && minWidthFromCss > 0) {
        return minWidthFromCss;
      }

      // try to guess
      const $hiddenElement = $node
        .clone()
        .css({
          left: -10000,
          top: -10000,
          position: 'absolute',
          display: 'inline',
          visibility: 'visible',
          width: 'auto',
          fontFamily: $node.css('font-family'),
          fontSize: $node.css('font-size'),
          padding: $node.css('padding'),
        })
        .appendTo('body');
      let minWidth = parseInt($hiddenElement.width());
      $hiddenElement.remove();
      if (!$node.hasClass('sorting_disabled')) {
        minWidth += 20; // sortable column needs a bit more space for the icon
      }
      return minWidth < 30 ? 30 : minWidth;
    },
    _fnGetMaxWidthOf: function ($node) {
      return this._fnGetWidthOfValue($node.css('max-width'));
    },
    _fnGetWidthOfValue: function (widthStr) {
      if (widthStr === 'none') {
        return -1;
      }
      return parseInt(widthStr.match(/(\d+)px/gi));
    },
    _fnBoundCheck: function (changedWidth, element) {
      const thWishWidth = (typeof this.s.state.originalWidth[element.index()] !== 'undefined' ? this.s.state.originalWidth[element.index()] : this._fnGetCurrentWidth(element)) + changedWidth;

      // min bound
      if (this.s.state.minWidth !== -1 && thWishWidth < this.s.state.minWidth) {
        const addBackToMinWidth = this.s.state.minWidth - thWishWidth;
        changedWidth += addBackToMinWidth;
        this._fnShowMinBoundReached();
      } else {
        this.s.state.minBoundAllowClass = true;
      }

      // max bound
      if (this.s.state.maxWidth !== -1 && thWishWidth > this.s.state.maxWidth) {
        const substractFromMaxWidth = thWishWidth - this.s.state.maxWidth;
        changedWidth -= substractFromMaxWidth;
        this._fnShowMaxBoundReached();
      } else {
        this.s.state.maxBoundAllowClass = true;
      }

      return changedWidth;
    },
    _fnShowMinBoundReached: function () {
      const self = this;
      if (this.s.state.minBoundAllowClass && this.s.state.$element) {
        this.s.state.$element.addClass(this.s.opts.minBoundClass);
        const $currentElement = this.s.state.$element;
        setTimeout(function () {
          $currentElement.removeClass(self.s.opts.minBoundClass);
        }, 500);
        this.s.state.minBoundAllowClass = false;
      }
    },

    _fnShowMaxBoundReached: function () {
      const self = this;
      if (this.s.state.maxBoundAllowClass && this.s.state.$element) {
        this.s.state.$element.addClass(this.s.opts.maxBoundClass);
        const $currentElement = this.s.state.$element;
        setTimeout(function () {
          $currentElement.removeClass(self.s.opts.maxBoundClass);
        }, 500);
        this.s.state.maxBoundAllowClass = false;
      }
    },

    _fnMapColumn: function (column) {
      return { idx: column.idx, width: column.sWidth };
    },
    _fnIsLastResizableColumnDragging: function (draggingColumn) {
      const visibleColumns = this._fnGetAllColumns().filter(function (column) {
        return $(column.nTh).is(':visible');
      });
      const indexOfColumn = visibleColumns.indexOf(draggingColumn);
      if (indexOfColumn === visibleColumns.length - 1) {
        return true;
      }
      for (let counter = indexOfColumn + 1; counter < visibleColumns.length; counter++) {
        const column = visibleColumns[counter];
        if (this._fnIsColumnResizable(column)) {
          return false;
        }
      }
      return true;
    },
    _fnIsColumnResizable: function (column) {
      return this.s.opts.isResizable(column);
    },
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
    saveState: false,
    isResizable: function (column) {
      if (typeof column.isResizable === 'undefined') {
        return true;
      }
      return column.isResizable;
    },
    onResizeStart: function (column, columns) {},
    onResize: function (column) {},
    onResizeEnd: function (column, columns) {},
    stateSaveCallback: function (settings, data) {
      const stateStorageName = window.location.pathname + '/colResizeStateData';
      localStorage.setItem(stateStorageName, JSON.stringify(data));
    },
    stateLoadCallback: function (settings) {
      const stateStorageName = window.location.pathname + '/colResizeStateData';
      const data = localStorage.getItem(stateStorageName);
      return data != null ? JSON.parse(data) : null;
    },
    getMinWidthOf: null,
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
  ColResize.version = '1.7.0';

  /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
   * DataTables interfaces
   * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

  // Expose
  $.fn.dataTable.ColResize = ColResize;
  $.fn.DataTable.ColResize = ColResize;

  // Register a new feature with DataTables
  if (
    typeof $.fn.dataTable === 'function' &&
    typeof $.fn.dataTableExt.fnVersionCheck === 'function' &&
    $.fn.dataTableExt.fnVersionCheck('1.10.8')
  ) {
    $.fn.dataTableExt.aoFeatures.push({
      fnInit: function (settings) {
        const table = settings.oInstance;

        if (!settings._colResize) {
          const init = settings.oInit.colResize;
          const opts = $.extend({}, init, DataTable.defaults.colResize);
          new ColResize(settings, opts);
        } else {
          table.oApi._fnLog(settings, 1, 'ColResize: attempted to initialise twice. Ignoring second');
        }

        return null; /* No node for DataTables to insert */
      },
      sFeature: 'ColResize',
    });
  } else {
    alert('Warning: ColResize requires DataTables 1.10.8 or greater - www.datatables.net/download');
  }

  // Attach a listener to the document which listens for DataTables initialisation
  // events so we can automatically initialise
  $(document).on('preInit.dt.colResize', function (e, settings) {
    if (e.namespace !== 'dt') {
      return;
    }

    const init = settings.oInit.colResize;
    const defaults = DataTable.defaults.colResize;

    if (init || defaults) {
      const opts = $.extend({}, init, defaults);

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
  $.fn.dataTable.Api.register('colResize.save()', function () {
    return this.iterator('table', function (ctx) {
      ctx._colResize.fnSaveState();
    });
  });
  $.fn.dataTable.Api.register('colResize.restore()', function () {
    return this.iterator('table', function (ctx) {
      ctx._colResize.fnRestoreState();
    });
  });
}));
