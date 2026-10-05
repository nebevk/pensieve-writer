use serde::Serialize;
use tauri::command;
use windows::core::{Interface, HSTRING};
use windows::Win32::Foundation::{S_FALSE, S_OK};
use windows::Win32::Globalization::{
    ISpellChecker, ISpellChecker2, ISpellCheckerFactory, ISpellingError, SpellCheckerFactory,
};
use windows::Win32::System::Com::{
    CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordResult {
    word: String,
    flagged: bool,
    expect_flagged: bool,
    matches_expectation: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageProbe {
    tag: String,
    supported: bool,
    samples: Vec<WordResult>,
    error: Option<String>,
}

struct Sample {
    word: &'static str,
    expect_flagged: bool,
}

#[command]
pub fn probe_spellcheck() -> Result<Vec<LanguageProbe>, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let factory: ISpellCheckerFactory = CoCreateInstance(
            &SpellCheckerFactory,
            None::<&windows::core::IUnknown>,
            CLSCTX_INPROC_SERVER,
        )
        .map_err(|error| error.to_string())?;

        let english = [
            Sample {
                word: "mispelled",
                expect_flagged: true,
            },
            Sample {
                word: "spelling",
                expect_flagged: false,
            },
        ];
        let slovenian = [
            Sample {
                word: "besda",
                expect_flagged: true,
            },
            Sample {
                word: "beseda",
                expect_flagged: false,
            },
            Sample {
                word: "češnja",
                expect_flagged: false,
            },
        ];

        Ok(vec![
            probe_language(&factory, "en-US", &english),
            probe_language(&factory, "sl", &slovenian),
            probe_language(&factory, "sl-SI", &slovenian),
        ])
    }
}

fn probe_language(
    factory: &ISpellCheckerFactory,
    tag: &str,
    samples: &[Sample],
) -> LanguageProbe {
    let language = HSTRING::from(tag);
    let supported = match unsafe { factory.IsSupported(&language) } {
        Ok(value) => value.as_bool(),
        Err(error) => {
            return LanguageProbe {
                tag: tag.to_string(),
                supported: false,
                samples: Vec::new(),
                error: Some(error.to_string()),
            };
        }
    };

    if !supported {
        return LanguageProbe {
            tag: tag.to_string(),
            supported: false,
            samples: Vec::new(),
            error: None,
        };
    }

    let checker = match unsafe { factory.CreateSpellChecker(&language) } {
        Ok(checker) => checker,
        Err(error) => {
            return LanguageProbe {
                tag: tag.to_string(),
                supported: true,
                samples: Vec::new(),
                error: Some(error.to_string()),
            };
        }
    };

    let mut results = Vec::with_capacity(samples.len());
    for sample in samples {
        match word_is_flagged(&checker, sample.word) {
            Ok(flagged) => results.push(WordResult {
                word: sample.word.to_string(),
                flagged,
                expect_flagged: sample.expect_flagged,
                matches_expectation: flagged == sample.expect_flagged,
            }),
            Err(error) => {
                return LanguageProbe {
                    tag: tag.to_string(),
                    supported: true,
                    samples: results,
                    error: Some(error),
                };
            }
        }
    }

    LanguageProbe {
        tag: tag.to_string(),
        supported: true,
        samples: results,
        error: None,
    }
}

fn language_tags(language: &str) -> &'static [&'static str] {
    if language == "sl" {
        &["sl", "sl-SI"]
    } else {
        &["en-US", "en"]
    }
}

fn checker_for(factory: &ISpellCheckerFactory, tag: &str) -> Option<ISpellChecker> {
    let language = HSTRING::from(tag);
    let supported = unsafe { factory.IsSupported(&language) }
        .map(|value| value.as_bool())
        .unwrap_or(false);
    if !supported {
        return None;
    }
    unsafe { factory.CreateSpellChecker(&language) }.ok()
}

fn add_word(factory: &ISpellCheckerFactory, tag: &str, word: &str) -> bool {
    checker_for(factory, tag).is_some_and(|checker| unsafe { checker.Add(&HSTRING::from(word)) }.is_ok())
}

/// Removing needs ISpellChecker2, which Windows 10 and newer have.
fn remove_word(factory: &ISpellCheckerFactory, tag: &str, word: &str) -> bool {
    checker_for(factory, tag)
        .and_then(|checker| checker.cast::<ISpellChecker2>().ok())
        .is_some_and(|checker| unsafe { checker.Remove(&HSTRING::from(word)) }.is_ok())
}

fn spell_checker_factory() -> Result<ISpellCheckerFactory, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        CoCreateInstance(
            &SpellCheckerFactory,
            None::<&windows::core::IUnknown>,
            CLSCTX_INPROC_SERVER,
        )
        .map_err(|error| error.to_string())
    }
}

#[command]
pub fn add_personal_word(language: String, word: String) -> Result<(), String> {
    let cleaned = word.trim();
    if cleaned.is_empty() || cleaned.chars().any(char::is_whitespace) {
        return Err("Enter one word, without spaces".into());
    }
    let factory = spell_checker_factory()?;
    let added = language_tags(&language)
        .iter()
        .any(|tag| add_word(&factory, tag, cleaned));
    if added {
        Ok(())
    } else {
        Err("Windows has no spell checker for that language".into())
    }
}

#[command]
pub fn remove_personal_word(language: String, word: String) -> Result<(), String> {
    let cleaned = word.trim();
    if cleaned.is_empty() {
        return Ok(());
    }
    let factory = spell_checker_factory()?;
    // Every tag, not just the first: the word may have been added under either.
    let removed = language_tags(&language)
        .iter()
        .fold(false, |any, tag| remove_word(&factory, tag, cleaned) || any);
    if removed {
        Ok(())
    } else {
        Err("Windows couldn't remove that word from its spell checker".into())
    }
}

fn word_is_flagged(checker: &ISpellChecker, word: &str) -> Result<bool, String> {
    let errors = unsafe { checker.Check(&HSTRING::from(word)) }.map_err(|error| error.to_string())?;
    let mut found: Option<ISpellingError> = None;
    let result = unsafe { errors.Next(&mut found) };
    if result == S_OK {
        Ok(found.is_some())
    } else if result == S_FALSE {
        Ok(false)
    } else {
        Err(result.to_string())
    }
}
