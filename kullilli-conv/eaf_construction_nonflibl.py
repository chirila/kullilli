# v1.5.3 basically accounting for when the flextext doesn't have aIDs
import xml.etree.ElementTree as ET
import flexible11 as flibl
import json
from datetime import datetime
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("-j", "--json", dest="export_json", help="Export as JSON as well", action="store_true")
args = parser.parse_args()

# Load/parse/create the relevant XML trees
config = json.load(open('to_eaf_config_ev.json'))
for text in config["eafs_flextexts"]:
    orig = ET.parse(text["original_eaf"]).getroot()
    flextext = ET.parse(text["flextext"]).getroot()
    # Use the existing info from the original EAF to fill in elements required at the top of the document
    eaf_tree = ET.ElementTree(ET.Element("ANNOTATION_DOCUMENT", attrib=orig.attrib))
    eaf = eaf_tree.getroot()
    eaf.append(orig[0])
    eaf.append(flibl.make_times(flextext))

    # Get all the speaker codes and make the tier codes for each, if you want specific speaker codes in ELAN but full names in flex
    # Not actually necessary though so we're skipping it
    morph_keys = ["txt", "cf", "gls", "msa", "variantTypes", "hn", "glsAppend" "morph_type"]
    # Fill in tiers
    # Make the linguistic (tier) types
    types = {
        config["language"]: ET.Element("LINGUISTIC_TYPE", attrib={
            "LINGUISTIC_TYPE_ID":config["language"],
            "GRAPHIC_REFERENCES":"false",
            "TIME_ALIGNABLE":"true"
            }),
        "words": ET.Element("LINGUISTIC_TYPE", attrib={
            "LINGUISTIC_TYPE_ID":"words",
            "GRAPHIC_REFERENCES":"false",
            "TIME_ALIGNABLE":"false",
            "CONSTRAINTS":"Symbolic_Subdivision"
            })
    }
    # seems like the original spec wanted each translation language to have its own type--I don't really know if that's necessary but I'm continuing that for now
    for tns_lang in config["translations"]:
        types["tns-"+tns_lang] = ET.Element("LINGUISTIC_TYPE", attrib={
            "LINGUISTIC_TYPE_ID":"tns-"+tns_lang,
            "GRAPHIC_REFERENCES":"false",
            "TIME_ALIGNABLE":"false",
            "CONSTRAINTS":"Symbolic_Association"
            })
    for data_type in ["notes", "target", "gls", "pos"]:
        types[data_type] = ET.Element("LINGUISTIC_TYPE", attrib={
            "LINGUISTIC_TYPE_ID": data_type,
            "GRAPHIC_REFERENCES":"false",
            "TIME_ALIGNABLE":"false",
            "CONSTRAINTS":"Symbolic_Association"
            })
    # make types for each morph-level tier
    for morph_key in morph_keys:
        if morph_key == "txt":
            types["morph-{}".format(morph_key)] = ET.Element("LINGUISTIC_TYPE", attrib={
            "LINGUISTIC_TYPE_ID":"morph-{}".format(morph_key),
            "GRAPHIC_REFERENCES":"false",
            "TIME_ALIGNABLE":"false",
            "CONSTRAINTS":"Symbolic_Subdivision"
            })
        else:
            types["morph-{}".format(morph_key)] = ET.Element("LINGUISTIC_TYPE", attrib={
            "LINGUISTIC_TYPE_ID":"morph-{}".format(morph_key),
            "GRAPHIC_REFERENCES":"false",
            "TIME_ALIGNABLE":"false",
            "CONSTRAINTS":"Symbolic_Association"
            })

    # Make the tiers, by unique speakers
    tiers_by_speaker = {}
    # Take the unique speakers from the ELAN file
    speakers = {i.attrib["PARTICIPANT"] for i in orig.findall("TIER") if "PARTICIPANT" in i.attrib.keys()}
    # In each iteration we're making ALL of the tiers related to the given speaker
    for i in speakers:
        speaker_tiers = []
        speaker = config["speakers"][i]
        base_tier_name = speaker["name"] + "-" + config["language"]# + "-"
        # Parent tier is the transcription, labelled just as the speaker + language name
        parent_tier = ET.Element("TIER", attrib={
                "PARTICIPANT":speaker["name"],
                "LINGUISTIC_TYPE_REF":config["language"],
                "TIER_ID":base_tier_name
                })
        speaker_tiers.append(parent_tier)
        # translation tiers
        for tns_lang in config["translations"]:
            speaker_tiers.append(ET.Element("TIER", attrib={
                "LINGUISTIC_TYPE_REF":"tns-"+tns_lang,
                "PARENT_REF":base_tier_name,
                "PARTICIPANT":speaker["name"],
                "TIER_ID":speaker["name"]+"-tns-"+tns_lang
            }))
        # notes, xds
        for note_type in ["notes", "xds"]:
            speaker_tiers.append(ET.Element("TIER", attrib={
                "LINGUISTIC_TYPE_REF":"notes",
                "PARENT_REF":base_tier_name,
                "PARTICIPANT":speaker["name"],
                "TIER_ID":speaker["name"] + "-" + note_type
            }))
        # phonetic words
        speaker_tiers.append(ET.Element("TIER", attrib={
            "LINGUISTIC_TYPE_REF":"words",
            "PARENT_REF":base_tier_name ,
            "PARTICIPANT":speaker["name"],
            "TIER_ID":base_tier_name + "-words"
        }))

        data_types = ["gls", "pos", "morph-txt"]
        # non-target
        for data_type in data_types:
                speaker_tiers.append(ET.Element("TIER", attrib={
                "LINGUISTIC_TYPE_REF":data_type,
                "PARENT_REF":base_tier_name + "-words",
                "PARTICIPANT":speaker["name"],
                "TIER_ID":base_tier_name + "-" + data_type
            }))
        # non-target morph info
        for morph_key in morph_keys[1:]:
            speaker_tiers.append(ET.Element("TIER", attrib={
                "LINGUISTIC_TYPE_REF":"morph-{}".format(morph_key),
                "PARENT_REF":base_tier_name + "-morph-txt",
                "PARTICIPANT":speaker["name"],
                "TIER_ID":base_tier_name + "-morph-{}".format(morph_key)
            }))
        if speaker["kid"]:
            # target phrase
            speaker_tiers.append(ET.Element("TIER", attrib={
                "LINGUISTIC_TYPE_REF":"target",
                "PARENT_REF":base_tier_name,
                "PARTICIPANT":speaker["name"],
                "TIER_ID":base_tier_name + "-target"
            }))
            # target-words
            speaker_tiers.append(ET.Element("TIER", attrib={
                "LINGUISTIC_TYPE_REF":"words",
                "PARENT_REF":base_tier_name + "-target",
                "PARTICIPANT":speaker["name"],
                "TIER_ID":base_tier_name + "-target-words"
            }))
            # the rest
            for data_type in data_types:
                speaker_tiers.append(ET.Element("TIER", attrib={
                "LINGUISTIC_TYPE_REF":"target-"+ data_type,
                "PARENT_REF":base_tier_name + "-target-words",
                "PARTICIPANT":speaker["name"],
                "TIER_ID":base_tier_name + "-target-" + data_type
            }))
            for morph_key in morph_keys[1:]:
                speaker_tiers.append(ET.Element("TIER", attrib={
                    "LINGUISTIC_TYPE_REF":"morph-{}".format(morph_key),
                    "PARENT_REF":base_tier_name + "-target-morph-txt",
                    "PARTICIPANT":speaker["name"],
                    "TIER_ID":base_tier_name + "-target-morph-{}".format(morph_key)
                    }))
        tiers_by_speaker[i] = speaker_tiers

    for speaker, tier_list in tiers_by_speaker.items():
        for speaker_tier in tier_list:
            eaf.append(speaker_tier)

    # Concatenate baselines, glosses, etc (make a function to concatenate and return a single string (well, a few strings, each for a different layer like baseline, gls, words, etc))
    # Collect flextext phrase tiers in a dict of segnum:phrase_el pairs
    all_phrases = {phrase[0].text: phrase for phrase in flextext.findall(".//*phrase")}
    # If there are multiple phrases in a paragraph, put them under one key without the decimal
    combined_phrases = {}
    for k,v in all_phrases.items():
        if k.split(".")[0] not in combined_phrases.keys():
            combined_phrases[k.split(".")[0]] = [v]
        else:
            combined_phrases[k.split(".")[0]] += [v]

    # Combining multiple phrases into one element, just replace those in combined_phrases
    # combined_phrases_collapsed = combined_phrases
    for segnum, tiers in {segnum:tiers for segnum, tiers in combined_phrases.items() if len(tiers) > 1}.items():
        # Only thing that this might be weird about is the fact that we're giving the last phrase's guid to the thing; but we aren't using the guid at all in ELAN so it shouldn't matter
        full_tier = tiers[0]
        full_tier.attrib = tiers[-1].attrib
        full_tier.find(".//item[@type='segnum']").text = segnum
        for extra_tier in tiers[1:]:
            # full_tier.append(extra_tier.find(".//words"))
            for word in extra_tier.find(".//words"):
                full_tier.find(".//words").append(word)
            # this @type!=val thing isn't a thing before python 3.10
            for i in extra_tier.findall(".//item[@type!='segnum']"):
                full_tier.append(i)
        # combined_phrases_collapsed[segnum] = full_tier
        combined_phrases[segnum] = [full_tier]
    # take the phrases out of lists
    phrases = {k:v[0] for k,v in combined_phrases.items()}

    # Make a slot for every possible thing per utterance
    aID_count = 1
    concatenated = {
        "original_eaf":text["original_eaf"],
        "flextext":text["flextext"],
        "media_file":orig[0][0].attrib["MEDIA_URL"]
    }
    segments = {}
    for segnum, phrase in phrases.items():
        phrase_dict = {}
        phrase_dict["full_text"] = " ".join([i.text for i in phrase.findall(".//word/item[@type='txt']")])
        phrase_dict["times"] = {
            "begin": {
                "ts_ref": eaf.find("TIME_ORDER").find(".//TIME_SLOT[@TIME_VALUE='{}']".format(phrase.attrib["begin-time-offset"])).attrib["TIME_SLOT_ID"],
                "time": eaf.find("TIME_ORDER").find(".//TIME_SLOT[@TIME_VALUE='{}']".format(phrase.attrib["begin-time-offset"])).attrib["TIME_VALUE"]
            },
            "end": {
                "ts_ref": eaf.find("TIME_ORDER").find(".//TIME_SLOT[@TIME_VALUE='{}']".format(phrase.attrib["end-time-offset"])).attrib["TIME_SLOT_ID"],
                "time": eaf.find("TIME_ORDER").find(".//TIME_SLOT[@TIME_VALUE='{}']".format(phrase.attrib["end-time-offset"])).attrib["TIME_VALUE"]
            }
        }

        translations = phrase.findall("./item[@type='gls']")
        for tns_lang in config["translations"]:
            phrase_dict["tns-"+tns_lang] = ""
            for gls in translations:
                if gls.attrib["lang"] == tns_lang:
                    phrase_dict["tns-"+tns_lang] = gls.text

        notes = ""
        phon_tar = ""
        orig_aID = ""
        speaker = ""
        xds = ""
        for note in phrase.findall("./item[@type='note']"):
            if not note.text:
                continue
            if note.text == "Phonetic" or note.text == "Target":
                phon_tar = note.text
                if note.text == "Phonetic":
                    phrase_dict["alignable_aID"] = aID_count
                    aID_count += 1
            elif note.text[0] == "a" and note.text[1] in "1234567890":
                orig_aID = note.text
            elif note.text in config["speakers"].keys():
                speaker = note.text
            elif note.text in config["xds"]:
                speaker = note.text
            # all other notes will appear on the same tier, concatenated
            else:
                if len(notes) == 0:
                    notes = note.text
                else:
                    notes += "; " + note.text
            if "alignable_aID" not in phrase_dict.keys():
                phrase_dict["alignable_aID"] = aID_count
                aID_count += 1

        phrase_dict["phon_tar"] = phon_tar
        phrase_dict["orig_aID"] = orig_aID
        phrase_dict["speaker"] = speaker
        phrase_dict["xds"] = xds
        phrase_dict["notes"] = notes
            
        word_list = []
        for word in phrase.findall(".//word"):
            word_info = {}
            if word.find("./item[@lang='{}']".format(config["language"])) != None:
                word_info["word_text"] = word.find("./item[@lang='{}']".format(config["language"])).text
            else:
                word_info["word_text"] = ""
            for info_type in ["pos", "gls"]:
                if word.find("./item[@type='{}']".format(info_type)) != None:
                    word_info[info_type] = word.find("./item[@type='{}']".format(info_type)).text
                else:
                    word_info[info_type] = ""

            these_morphs = []
            for morph in word.findall(".//morph"):
                this_morph = {}
                if "type" in morph.attrib.keys():
                    this_morph["morph-morph_type"] = morph.attrib["type"]
                else:
                    this_morph["morph-morph_type"] = ""
                # exclude morph_type from this, since we deal with it above
                for morph_key in morph_keys[:-1]:
                    if morph.find(".//item[@type='{}']".format(morph_key)) != None:
                        this_morph["morph-"+morph_key] = morph.find(".//item[@type='{}']".format(morph_key)).text
                    else:
                        this_morph["morph-"+morph_key] = ""
                these_morphs.append(this_morph)
            word_info["morphs"] = these_morphs
            word_list.append(word_info)
        phrase_dict["word_list"] = word_list
        segments[segnum] = phrase_dict
    concatenated["segments"] = segments

    # Look for els that share aID and put them together for phonetic/target combining
    for targ_segnum, targ_phrase in concatenated["segments"].items():
        if targ_phrase["phon_tar"] == "Target":
            for phon_segnum, phon_phrase in concatenated["segments"].items():
                if targ_phrase["orig_aID"] == phon_phrase["orig_aID"] and phon_phrase["phon_tar"] == "Phonetic":
                    targ_phrase["ann_ref"] = phon_phrase["alignable_aID"]
                    targ_phrase["ref_aID"] = aID_count
                    targ_phrase["speaker"] = phon_phrase["speaker"]
                    aID_count += 1

    # Make the els for EAF
    # count for tracker
    segs = len(concatenated["segments"].keys())
    seg_perc = int(segs/50)
    milestones = [i*seg_perc for i in range(50)]
    for segnum, phrase in concatenated["segments"].items():
        if int(segnum) in milestones:
            print(milestones.index(int(segnum))*2, "percent complete")
        # if phrase["phon_tar"] == "Target":
        #     base_tier_name = phrase["speaker"] + "-" + config["language"] + "-target"
        # elif phrase["phon_tar"] == "Phonetic":
        #     base_tier_name = phrase["speaker"] + "-" + config["language"] + "-phonetic"
        base_tier_name = phrase["speaker"] + "-" + config["language"]

        # make annotation el
        baseline_ann = ET.Element("ANNOTATION")
        # if phrase["phon_tar"] == "Phonetic":
        #     new_baseline_ann = ET.Element("ALIGNABLE_ANNOTATION", attrib={"ANNOTATION_ID":"a"+str(phrase["alignable_aID"]), "TIME_SLOT_REF1":phrase["times"]["begin"]["ts_ref"], "TIME_SLOT_REF2":phrase["times"]["end"]["ts_ref"]})

        #     # text_aID is the aID that words will refer to
        #     text_aID = phrase["alignable_aID"]
        # # for other types (ie targets)
        # elif phrase["phon_tar"] == "Target":
        #     new_baseline_ann = ET.Element("REF_ANNOTATION", attrib={"ANNOTATION_ID":"a"+str(phrase["ref_aID"]), "ANNOTATION_REF":"a"+str(phrase["ann_ref"])})
        #     # text_aID is the aID that words will refer to
        #     text_aID = phrase["ref_aID"]
        try:
            new_baseline_ann = ET.Element("ALIGNABLE_ANNOTATION", attrib={"ANNOTATION_ID":"a"+str(phrase["alignable_aID"]), "TIME_SLOT_REF1":phrase["times"]["begin"]["ts_ref"], "TIME_SLOT_REF2":phrase["times"]["end"]["ts_ref"]})
        except:
            print(segnum)
        # text_aID is the aID that words will refer to
        text_aID = phrase["alignable_aID"]

        new_baseline_ann_val = ET.Element("ANNOTATION_VALUE")
        new_baseline_ann_val.text = phrase["full_text"]
        new_baseline_ann.append(new_baseline_ann_val)
        baseline_ann.append(new_baseline_ann)
        baseline_tier = eaf.find(".//TIER[@TIER_ID='{}']".format(base_tier_name))
        try:
            baseline_tier.append(baseline_ann)
        except:
            print(base_tier_name)
            print(tiers_by_speaker)
            raise
        
        translation_tier_names = ["tns-"+tns_lang for tns_lang in config["translations"]]
        for content_type in ["notes", "xds"]+translation_tier_names:
            # looks kind of weird but we're returning the incremented aID_count, since the XML is being edited in place when using the function
            aID_count = flibl.make_assoc_annotation(phrase["speaker"], content_type, phrase, new_baseline_ann.attrib["ANNOTATION_ID"], aID_count, eaf)

        new_phrase = 1
        for word in phrase["word_list"]:
            word_aID = aID_count
            aID_count += 1
            word_tier = eaf.find(".//TIER[@TIER_ID='{}']".format(base_tier_name + "-words"))

            if new_phrase:
                new_word_ann = ET.Element("REF_ANNOTATION", attrib={"ANNOTATION_ID":"a"+str(word_aID), "ANNOTATION_REF":"a"+str(text_aID)})
            else:
                new_word_ann = ET.Element("REF_ANNOTATION", attrib={"ANNOTATION_ID":"a"+str(word_aID), "ANNOTATION_REF":"a"+str(text_aID), "PREVIOUS_ANNOTATION":"a"+str(prev_word_aID)})
            new_phrase = 0
        
            new_word_ann_val = ET.Element("ANNOTATION_VALUE")
            new_word_ann_val.text = word["word_text"]
            new_word_ann.append(new_word_ann_val)
            word_ann = ET.Element("ANNOTATION")
            word_ann.append(new_word_ann)
            try:
                word_tier.append(word_ann)
            except:
                print(word_tier)
                raise
            
            for content_type in ["pos", "gls"]:
                aID_count = flibl.make_assoc_annotation(base_tier_name, content_type, word, "a"+str(word_aID), aID_count, eaf)
            new_word = 1
            for morph in word["morphs"]:
                # it's doubling morph-txt anns. it's either happening when we're creating the annotations and we're making a new one, or it's when we're making the dict. what happens is that the second one refers to the first one.
                morph_txt_tier = eaf.find(".//TIER[@TIER_ID='{}']".format(base_tier_name + "-morph-txt"))
                morph_txt_aID = aID_count
                aID_count += 1
                if new_word:
                    new_morph_txt_ann = ET.Element("REF_ANNOTATION", attrib={"ANNOTATION_ID":"a"+str(morph_txt_aID), "ANNOTATION_REF":"a"+str(word_aID)})
                else:
                    new_morph_txt_ann = ET.Element("REF_ANNOTATION", attrib={"ANNOTATION_ID":"a"+str(morph_txt_aID), "ANNOTATION_REF":"a"+str(word_aID), "PREVIOUS_ANNOTATION":"a"+str(prev_morph_txt_aID)})
                new_word = 0
                new_morph_txt_ann_val = ET.Element("ANNOTATION_VALUE")
                new_morph_txt_ann_val.text = morph["morph-txt"]
                new_morph_txt_ann.append(new_morph_txt_ann_val)
                morph_txt_ann = ET.Element("ANNOTATION")
                morph_txt_ann.append(new_morph_txt_ann)
                morph_txt_tier.append(morph_txt_ann)
                morph_dict = {i:morph[i] for i in morph if i != "morph-txt"}
                for morph_type_name in morph_dict.keys():
                    content_type = morph_type_name
                    aID_count = flibl.make_assoc_annotation(base_tier_name, content_type, morph_dict, "a"+str(morph_txt_aID), aID_count, eaf)

                prev_morph_txt_aID = morph_txt_aID
            prev_word_aID = word_aID
                    
    for speaker, tiers in tiers_by_speaker.items():
        for tier in tiers:
            if not tier in eaf:
                eaf.append(tier)

    for tier_type in types:
        eaf.append(types[tier_type])
        

    for language in config["languages"]:
        language_el = ET.Element("LANGUAGE", attrib={"LANG_DEF":language["LANG_DEF"], "LANG_ID":language["LANG_ID"], "LANG_LABEL":language["LANG_LABEL"]})
        eaf.append(language_el)
    for language_el in orig.findall(".//LANGUAGE"):
        eaf.append(language_el)
        
    for constraint in orig.findall(".//CONSTRAINT"):
        eaf.append(constraint)

    for cv in orig.findall(".//CONTROLLED_VOCABULARY"):
        eaf.append(cv)
        
    eaf.find(".//PROPERTY[@NAME='lastUsedAnnotationId']").text = str(aID_count - 1)

    now = str(datetime.now()).split(" ")
    time = now[1].split(":")
    date_time = now[0].replace("-", "_") + "-{}_{}".format(time[0], time[1])
    ET.indent(eaf, space="\t", level=0)
    eaf_tree.write(text["flextext"][:-9] + "-flex_export-" + date_time + ".eaf", encoding="unicode")
    if args.export_json:
        json.dump(concatenated, open(text["flextext"][:-9] + "-flex_export-" + date_time + ".json", mode="w", encoding="utf8"), indent=1)