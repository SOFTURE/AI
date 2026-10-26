import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../src/ui/table.js";

describe("Table", () => {
  it("has a 34 px muted header and keeps the line under the last row", () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(html).toMatch(/<th data-slot="table-head" class="h-\[34px\][^"]*font-normal[^"]*text-muted-foreground/);
    expect(html).toContain('<tbody data-slot="table-body" class="">');
  });
});
