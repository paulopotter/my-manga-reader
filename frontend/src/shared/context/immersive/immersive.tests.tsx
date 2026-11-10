import { act, renderHook } from '@testing-library/react-native';
import { ImmersiveProvider, useImmersive } from './immersive.context';

describe('ImmersiveProvider / useImmersive', () => {
  it('defaults to immersive=false', () => {
    const { result } = renderHook(() => useImmersive(), { wrapper: ImmersiveProvider });
    expect(result.current.immersive).toBe(false);
  });

  it('setImmersive(true) flips the flag; setImmersive(false) restores it', () => {
    const { result } = renderHook(() => useImmersive(), { wrapper: ImmersiveProvider });
    act(() => result.current.setImmersive(true));
    expect(result.current.immersive).toBe(true);
    act(() => result.current.setImmersive(false));
    expect(result.current.immersive).toBe(false);
  });

  it('outside a provider it is a no-op with immersive=false (safe default)', () => {
    const { result } = renderHook(() => useImmersive());
    expect(result.current.immersive).toBe(false);
    act(() => result.current.setImmersive(true));
    act(() => result.current.setTopInset(38));
    expect(result.current.immersive).toBe(false);
    expect(result.current.topInset).toBe(0);
  });

  it('keeps the top inset it was given, defaulting to 0', () => {
    const { result } = renderHook(() => useImmersive(), { wrapper: ImmersiveProvider });
    expect(result.current.topInset).toBe(0);
    act(() => result.current.setTopInset(38));
    expect(result.current.topInset).toBe(38);
  });
});
