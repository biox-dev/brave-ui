/**
 * 极简分隔文本解析器（TSV / CSV）。
 *
 * 后端只返回原始分隔文本，表格由前端自行解析。这里实现 RFC4180 的常见子集：
 * - 双引号包裹的字段可包含分隔符与换行；
 * - `""` 表示字段内的一个双引号；
 * - 兼容 `\n` / `\r\n` 换行。
 */
export const parseDelimitedText = (text: string, delimiter: string): string[][] => {
	const sep = delimiter || ",";
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;
	let index = 0;

	while (index < text.length) {
		const ch = text[index];

		if (inQuotes) {
			if (ch === '"') {
				if (text[index + 1] === '"') {
					field += '"';
					index += 2;
					continue;
				}
				inQuotes = false;
				index += 1;
				continue;
			}
			field += ch;
			index += 1;
			continue;
		}

		if (ch === '"') {
			inQuotes = true;
			index += 1;
			continue;
		}
		if (ch === sep) {
			row.push(field);
			field = "";
			index += 1;
			continue;
		}
		if (ch === "\r" || ch === "\n") {
			if (ch === "\r" && text[index + 1] === "\n") {
				index += 1;
			}
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			index += 1;
			continue;
		}

		field += ch;
		index += 1;
	}

	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	// 去掉文件末尾的空行（只有一个空单元格的行）。
	while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
		rows.pop();
	}

	return rows;
};
