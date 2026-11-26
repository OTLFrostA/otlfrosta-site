// Adjust stale screenshot test expectation in the temporary pinned checkout only.
// Never change the product markup or conceal available formats.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const file = '.exporter/tests/e2e/readme_screenshots.spec.ts';
const source = fs.readFileSync(file,'utf8');
const original = "await expect(popup.locator('#formatTabs .tab-btn')).toHaveCount(4);";
assert(source.includes(original),'Recheck the actual release screenshot test before updating the pinned version');
const updated = "await expect(popup.locator('#formatTabs .tab-btn')).toHaveCount(5);\n    for (const format of ['markdown','pdf','docx','html','json']) {\n        await expect(popup.locator('#formatTabs .tab-btn[data-format=\"' + format + '\"]')).toHaveCount(1);\n    }";
fs.writeFileSync(file,source.replace(original,updated));
