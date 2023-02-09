import flexible12 as flibl
from xml.etree import ElementTree as ET
import json

# this is flibl for a no-bells-nor-whistles flextext: no time alignment, one vernacular and one analysis language, no speaker specification. all it does is make the fibl interchange json with glosses
text = "001-064 Kullilli sentences.flextext" # for now
# gll_texts = ["001-064 Kullilli sentences.flextext"] # etc
# for text in gll_texts: etc

ft = ET.parse(text).getroot()
new_json = {
    "flextext":text
}
for phrase in ft.findall(".//phrase"):
    segnum = phrase.find("./item[@type='segnum']")
    full_text = ""
    for word in phrase.findall(".//word"):
        # if the item in word is punctuation, don't add an extra space
        if not full_text and word[0].attrib["type"] == "punct":
            


json.dump(new_json)