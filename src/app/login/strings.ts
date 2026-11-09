import { APP_LANG } from "@/lib/brand";

const ko = {
  title: "가족 로그인",
  sub: "할머니의 하루를 보고, 할머니 폰을 연결해요.",
  email: "이메일",
  password: "비밀번호",
  signIn: "로그인",
  signingIn: "로그인 중",
  wrong: "이메일이나 비밀번호가 맞지 않아요.",
  demo: "데모로 바로 보기",
  deviceTitle: "아직 연결되지 않은 기기예요",
  deviceBody: "가족이 관리 화면에서 '할머니 폰 연결'을 누르고, 나오는 QR을 이 폰으로 찍으면 바로 시작돼요.",
  deviceDemo: "데모로 시작하기",
  deviceFamily: "가족이신가요? 로그인하고 이 폰 연결하기",
  pairBad: "연결 코드가 만료됐어요. 가족에게 새 QR을 받아 주세요.",
};

const en: typeof ko = {
  title: "Family sign in",
  sub: "See grandma's day and connect her phone.",
  email: "Email",
  password: "Password",
  signIn: "Sign in",
  signingIn: "Signing in",
  wrong: "That email and password don't match.",
  demo: "Open the demo instead",
  deviceTitle: "This phone isn't connected yet",
  deviceBody: "Ask your family to tap 'Connect grandma's phone' in their admin and scan the QR code with this phone. That's all.",
  deviceDemo: "Start the demo",
  deviceFamily: "Family? Sign in to connect this phone",
  pairBad: "This connection code has expired. Ask your family for a new QR code.",
};

export const L = APP_LANG === "en" ? en : ko;
