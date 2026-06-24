/// <reference types="vite/client" />
import type { SignId } from '../../../engine/types';
import aries from '../../../assets/zodiac/aries.svg?url';
import taurus from '../../../assets/zodiac/taurus.svg?url';
import gemini from '../../../assets/zodiac/gemini.svg?url';
import cancer from '../../../assets/zodiac/cancer.svg?url';
import leo from '../../../assets/zodiac/leo.svg?url';
import virgo from '../../../assets/zodiac/virgo.svg?url';
import libra from '../../../assets/zodiac/libra.svg?url';
import scorpio from '../../../assets/zodiac/scorpio.svg?url';
import sagittarius from '../../../assets/zodiac/sagittarius.svg?url';
import capricorn from '../../../assets/zodiac/capricorn.svg?url';
import aquarius from '../../../assets/zodiac/aquarius.svg?url';
import pisces from '../../../assets/zodiac/pisces.svg?url';

export const SIGN_ART: Record<SignId, string> = {
  aries, taurus, gemini, cancer, leo, virgo,
  libra, scorpio, sagittarius, capricorn, aquarius, pisces,
};
