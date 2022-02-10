/// <reference types="jquery" />
/// <reference types="datatables.net"/>

declare namespace DataTables {
	interface Settings {
		colResize?: ColResizeSettings;
	}

	interface ColResizeSettings {
		isEnabled?: boolean;
		hoverClass?: string;
		hasBoundCheck?: boolean;
		minBoundClass?: string;
		maxBoundClass?: string;
		isResizable?: (column : ColumnLegacy) => boolean;
		onResizeStart?: (column: ColumnLegacy, columns : (ColumnLegacy)[]) => void;
		onResize?: (column: ColumnLegacy) => void;
		onResizeEnd?: (column: ColumnLegacy, columns : (ColumnLegacy)[]) => void;
		getMinWidthOf?: ($thNode : JQuery<HTMLTableCellElement>) => number;
	}

	interface Api {
		colResize: {
			enable(): Api;
			disable(): Api;
			reset(): Api;
		};
	}
}