/** A realistic XML sample (RSS-style feed with namespace, comment, CDATA, attributes). */
export const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>FormatWell Blog</title>
    <link>https://formatwell.app/blog</link>
    <description>Notes on parsing, formatting, and developer tools.</description>
    <language>en-us</language>
    <!-- Latest three posts -->
    <item>
      <title>Locating JSON errors precisely</title>
      <link>https://formatwell.app/blog/json-errors</link>
      <guid isPermaLink="true">https://formatwell.app/blog/json-errors</guid>
      <pubDate>Mon, 07 Jul 2026 09:00:00 GMT</pubDate>
      <category>engineering</category>
      <content:encoded><![CDATA[<p>Column & line mapping across engines.</p>]]></content:encoded>
    </item>
    <item>
      <title>Why everything runs in your browser</title>
      <link>https://formatwell.app/blog/client-side</link>
      <guid isPermaLink="true">https://formatwell.app/blog/client-side</guid>
      <pubDate>Mon, 30 Jun 2026 09:00:00 GMT</pubDate>
      <category>privacy</category>
    </item>
  </channel>
</rss>`;
