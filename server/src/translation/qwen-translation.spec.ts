import { TranslationService } from './translation.service';
describe('Qwen edition translation', () => {
  it('uses Qwen instead of downloading NLLB', async () => {
    const ai = { getEdition: () => 'qwen3-only', complete: jest.fn().mockResolvedValue('Habari') };
    const service = new TranslationService(ai as any);
    const loader = jest.spyOn(service as any, '_getTranslator');
    expect(await service.translate('Hello', 'eng_Latn', 'swh_Latn')).toBe('Habari');
    expect(ai.complete).toHaveBeenCalledWith('Hello', expect.stringContaining('English to Swahili'));
    expect(loader).not.toHaveBeenCalled();
  });
});
