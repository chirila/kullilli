# import flexible12 as flibl
from xml.etree import ElementTree as ET
import json

# this is flibl for a no-bells-nor-whistles flextext: no time alignment, one vernacular and one analysis language, no speaker specification. all it does is make the fibl interchange json with glosses
# text = "../001-064 Kullilli sentences.flextext" # for now
gll_texts = [
    "../001-064 Kullilli sentences.flextext",
    "../065-128 Kullilli sentences.flextext",
    "../129-192 Kullilli sentences.flextext",
    "../193-256 Kullilli sentences.flextext",
    "../257-320 Kullilli sentences.flextext",
    "../321-384 Kullilli sentences.flextext",
    "../385-448 Kullilli sentences.flextext",
    "../449-514 Kullilli sentences.flextext",
    "../Animal trouble in the camp.flextext",
    "../Breen Sentences.flextext"
    ] # etc
# for text in gll_texts: etc
for text in gll_texts:
    ft = ET.parse(text).getroot()
    new_json = {
        "flextext":text
    }
    morph_keys = ["txt", "cf", "gls", "msa", "variantTypes", "hn", "glsAppend" "morph_type"]
    for phrase in ft.findall(".//phrase"):
        segnum = phrase.find("./item[@type='segnum']").text
        segdict = {}
        full_text = ""
        word_list = []
        # add the words into the segdict
        for word in phrase.findall(".//word"):
            # add this word's text to the segdict
            # if the item in word is punctuation or at the front of the phrase, don't add an extra space
            if not full_text or word[0].attrib["type"] == "punct":
                full_text += word[0].text
            else:
                full_text += " " + word[0].text
            # add each word to the word_list
            word_dict = {}
            word_dict["word_text"] = word[0].text
            # add morphs the word
            morph_list = []
            for morph in word.findall(".//morph"):
                # make the dict with all the morph information
                morph_dict = {}
                for morph_info in morph_keys:
                    try:
                        morph_dict["morph-{}".format(morph_info)] = morph.find("./item[@type='{}']".format(morph_info)).text
                    except:
                        morph_dict["morph-{}".format(morph_info)] = ""
                morph_list.append(morph_dict)

            word_dict["morphs"] = morph_list
            try:
                word_dict["pos"] = word.find("./item[@type='pos']").text
            except:
                word_dict["pos"] = ""
            try:
                word_dict["gls"] = word.find("./item[@type='gls']").text
            except:
                word_dict["gls"] = ""

            # put the word_dict in the word_list
            word_list.append(word_dict)
        segdict["word_list"] = word_list
        # translations = phrase.findall("./items[@type='gls']") # if we want to add a way to do this for flextexts with multiple analysis languages, find all the translation elements and make the distinct translation keys as you loop through them, appending -{}".format(translation.attrib["lang"]) to them
        # add translation to segdict
        try:
            segdict["translation"] = phrase.find("./item[@type='gls']").text
        except:
            segdict["translation"] = ""

        # put notes into the segdict
        notes = []
        try:
            for note in phrase.findall(".//item[@type='note']"):
                notes.append(note.text)
        except:
            pass
        segdict["notes"] = notes
        # add the phrase level baseline to the segdict
        segdict["full_text"] = full_text


        # add the segdict to the main dict
        new_json[segnum] = segdict


    json.dump(new_json, open(text[:-8] + "json", mode="w", encoding="utf8"), indent=1)