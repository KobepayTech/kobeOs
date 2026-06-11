import { Injectable, Logger } from '@nestjs/common';

/**
 * Offline translation via NLLB-200-distilled-600M (Meta / CC-BY-NC-4.0).
 *
 * Runs the ONNX-quantised model through @huggingface/transformers (the
 * 3.x rebrand of @xenova/transformers). First call downloads ~600 MB
 * to the user's HF cache; subsequent calls are local.
 *
 * Covers 200+ languages including the East-African set we care about
 * (Swahili, Amharic, Hausa, Yoruba, Zulu) plus the major commercial
 * languages (English, French, Arabic, Portuguese, Spanish).
 */

export type NllbLang =
  | 'eng_Latn' | 'swh_Latn' | 'fra_Latn' | 'arb_Arab'
  | 'por_Latn' | 'spa_Latn' | 'amh_Ethi' | 'hau_Latn'
  | 'yor_Latn' | 'zul_Latn' | 'ibo_Latn' | 'xho_Latn'
  | 'som_Latn' | 'lin_Latn' | 'kin_Latn';

interface TranslationPipelineCall {
  (text: string, opts: { src_lang: NllbLang; tgt_lang: NllbLang }): Promise<Array<{ translation_text: string }>>;
}

interface TranslationModule {
  pipeline: (task: string, model: string) => Promise<TranslationPipelineCall>;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger('TranslationService');
  private translator: Promise<TranslationPipelineCall> | null = null;

  /**
   * Human-readable language list for the front-end dropdowns. The code
   * field is the NLLB FLORES-200 tag the model expects.
   */
  static readonly LANGUAGES: Array<{ code: NllbLang; name: string; native: string }> = [
    { code: 'eng_Latn', name: 'English',    native: 'English'   },
    { code: 'swh_Latn', name: 'Swahili',    native: 'Kiswahili' },
    { code: 'fra_Latn', name: 'French',     native: 'Français'  },
    { code: 'arb_Arab', name: 'Arabic',     native: 'العربية'   },
    { code: 'por_Latn', name: 'Portuguese', native: 'Português' },
    { code: 'spa_Latn', name: 'Spanish',    native: 'Español'   },
    { code: 'amh_Ethi', name: 'Amharic',    native: 'አማርኛ'      },
    { code: 'hau_Latn', name: 'Hausa',      native: 'Hausa'     },
    { code: 'yor_Latn', name: 'Yoruba',     native: 'Yorùbá'    },
    { code: 'zul_Latn', name: 'Zulu',       native: 'isiZulu'   },
    { code: 'ibo_Latn', name: 'Igbo',       native: 'Igbo'      },
    { code: 'xho_Latn', name: 'Xhosa',      native: 'isiXhosa'  },
    { code: 'som_Latn', name: 'Somali',     native: 'Soomaali'  },
    { code: 'lin_Latn', name: 'Lingala',    native: 'Lingála'   },
    { code: 'kin_Latn', name: 'Kinyarwanda',native: 'Kinyarwanda' },
  ];

  async translate(text: string, source: NllbLang, target: NllbLang): Promise<string> {
    if (!text?.trim()) return '';
    if (source === target) return text;
    const translator = await this._getTranslator();
    const out = await translator(text, { src_lang: source, tgt_lang: target });
    return out?.[0]?.translation_text ?? '';
  }

  /**
   * Translate a list of strings in one call. The underlying model
   * batches internally; this is just a thin loop so we can attribute
   * each input to its output.
   */
  async translateMany(texts: string[], source: NllbLang, target: NllbLang): Promise<string[]> {
    const out: string[] = [];
    for (const t of texts) out.push(await this.translate(t, source, target));
    return out;
  }

  private async _getTranslator(): Promise<TranslationPipelineCall> {
    if (!this.translator) {
      this.translator = this._loadTranslator().catch((err) => {
        this.translator = null;
        throw err;
      });
    }
    return this.translator;
  }

  private async _loadTranslator(): Promise<TranslationPipelineCall> {
    const pkg = '@huggingface/transformers';
    const mod = (await import(pkg)) as unknown as TranslationModule;
    if (!mod?.pipeline) throw new Error('@huggingface/transformers is not installed. Run `npm install @huggingface/transformers` in server/.');
    this.logger.log('Loading NLLB-200-distilled-600M — first use downloads ~600 MB to the HF cache');
    return mod.pipeline('translation', 'Xenova/nllb-200-distilled-600M');
  }
}
