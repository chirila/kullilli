from xml.etree import ElementTree as ET
import json
import os

# this is flibl for a no-bells-nor-whistles flextext: no time alignment, no speaker specification. all it does is make the fibl interchange json with glosses

# define the morph information types
morph_keys = ["txt", "cf", "gls", "msa", "variantTypes", "hn", "glsAppend"]

# put in the directory where your flextexts are located
# make sure it ends with a /
flextext_dir = "data/flextext/"
# if your flextexts have an extension like "xml" or something else, change this
flextext_extension = "flextext"
# put in the directory where you would like your JSON files to go (it doesn't have to exist yet)
# make sure it ends with a /
json_dir = "data/json/"
# create list of texts by finding all the items in a specified directory with the specified extension 
texts = [file for file in os.listdir(flextext_dir) if not os.path.isdir(file) and file.endswith(flextext_extension)]
# make the directory where the new JSON files will live (and if it already exists, that's fine)
try:
    os.mkdir(json_dir)
except:
    pass

# make each JSON file
for text in texts:
    # open the flextext
    ft = ET.parse(flextext_dir+text).getroot()
    # start creating what will become the JSON
    new_json = {
        "flextext":text
    }

    # add the title(s) to the JSON
    try:
        for lang_title in ft.findall(".//item[@type='title']"):
            new_json["title-{}".format(lang_title.attrib["lang"])] = lang_title.text
    except:
        new_json["title"] = ""
    
    # initialize the dict of utterances
    new_json["utterances"] = {}

    for phrase in ft.findall(".//phrase"):
        try:
            segnum = phrase.find("./item[@type='segnum']").text
        except:
            pass
        segdict = {}
        full_text = ""
        word_list = []
        # add the words into the segdict
        try:
            words = phrase.findall(".//word")
        except:
            words = []
        for word in words:
            # add this word's text to the segdict
            # if the item in word is punctuation or at the front of the phrase, don't add an extra space
            if not full_text or word[0].attrib["type"] == "punct":
                full_text += word[0].text
            else:
                full_text += " " + word[0].text
            # add each word to the word_list
            word_dict = {}
            word_dict["word_text"] = word[0].text
            word_breakdown = ""
            # add morphs the word
            morph_list = []
            try:
                morphs = word.findall(".//morph")
            except:
                morphs = []
            for morph in morphs:
                # if you want the breakdown at the word level
                try:
                    word_breakdown += morph.find("./item[@type='txt']").text
                except:
                    pass
                # make the dict with all the morph information
                morph_dict = {}
                for morph_info in morph_keys:
                    try:
                        morph_dict["morph-{}".format(morph_info)] = morph.find("./item[@type='{}']".format(morph_info)).text
                    except:
                        # if you want all of the slots to appear, even if empty
                        # morph_dict["morph-{}".format(morph_info)] = ""
                        # if you want to exclude the slots if empty
                        pass
                try:
                    morph_dict["morph_type"] = morph.attrib["type"]
                except:
                    # if you want this to appear, even if empty
                    # morph_dict["morph_type"] = ""
                    # if you want to exclude it if empty
                    pass

                morph_list.append(morph_dict)
            word_dict["word_breakdown"] = word_breakdown

            word_dict["morphs"] = morph_list
            # add word level part of speech
            try:
                word_dict["pos"] = word.find("./item[@type='pos']").text
            except:
                word_dict["pos"] = ""
            # add word level gloss
            try:
                word_dict["gls"] = word.find("./item[@type='gls']").text
            except:
                word_dict["gls"] = ""

            # put the word_dict in the word_list
            word_list.append(word_dict)
        # add the phrase level baseline to the segdict
        segdict["full_text"] = full_text
        
        # add translation to segdict
        segdict["translations"] = {}
        try:
            for lang_translation in phrase.findall(".//item[@type='gls']"):
                segdict["translations"]["translation-{}".format(lang_translation.attrib["lang"])] = lang_translation.text
        except:
            # if you want an empty translation to appear when there is no translation
            # segdict["translation"] = ""
            # if you don't want the translation field to appear when there is no translation
            pass
        
        # add the word list to the segdict
        segdict["word_list"] = word_list

        # add notes to segdict
        try:
            notes = []
            for note in phrase.findall(".//item[@type='note']"):
                notes.append(note.text)
            segdict["notes"] = notes
        except:
            # if you want an empty note to appear when there are no notes
            # segdict["notes"] = [""]
            # if you don't want the notes field to appear when there are no notes
            pass
        
        # add the segdict to the main dict
        new_json["utterances"][segnum] = segdict

    # create the json
    json.dump(new_json, open(json_dir + text[:-1*len(flextext_extension)] + "json", mode="w", encoding="utf8"), indent=1)