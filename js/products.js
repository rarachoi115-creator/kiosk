/**
 * 몽글 마트 무인 계산대에서 사용할 상품 가격표와 도우미 함수를 모아 둔 파일입니다.
 * ("없음" 클래스는 카메라 앞에 상품이 없는 상태이므로 가격표에 넣지 않습니다.)
 */
(function (global) {
  "use strict";

  /**
   * 상품 목록 데이터
   * - className: Teachable Machine 모델의 클래스 이름
   * - name: 화면에 보여 줄 상품 이름 (클래스 이름과 동일)
   * - price: 원 단위 숫자 가격
   * - color: 상품을 대표하는 HEX 색상 코드
   */
  const PRODUCTS = [
    {
      className: "오예스",
      name: "오예스",
      price: 1500,
      color: "#6D4C41"
    },
    {
      className: "카스타드",
      name: "카스타드",
      price: 1700,
      color: "#F59E0B"
    },
    {
      className: "크리스피롤",
      name: "크리스피롤",
      price: 1200,
      color: "#EA580C"
    },
    {
      className: "청포도",
      name: "청포도",
      price: 1300,
      color: "#16A34A"
    }
  ];

  /**
   * 모델이 알려 준 클래스 이름으로 상품 정보를 찾습니다.
   * 해당하는 상품이 없으면(예: "없음") null을 돌려줍니다.
   *
   * @param {string} className - 모델이 인식한 클래스 이름
   * @returns {{ className: string, name: string, price: number, color: string } | null}
   */
  function findProductByClassName(className) {
    if (typeof className !== "string") {
      return null;
    }

    const trimmedName = className.trim();
    if (!trimmedName) {
      return null;
    }

    const matched = PRODUCTS.find(function (product) {
      return product.className === trimmedName;
    });

    return matched || null;
  }

  /**
   * 숫자 금액을 한국 원화 표기(예: "1,500원") 문자열로 바꿉니다.
   *
   * @param {number} amount - 원 단위 금액
   * @returns {string}
   */
  function formatPrice(amount) {
    const numeric = Number(amount);
    const safeAmount = Number.isFinite(numeric) ? Math.round(numeric) : 0;
    return safeAmount.toLocaleString("ko-KR") + "원";
  }

  // 다른 화면 스크립트에서 바로 쓸 수 있도록 전역에 등록
  global.PRODUCTS = PRODUCTS;
  global.findProductByClassName = findProductByClassName;
  global.formatPrice = formatPrice;
})(window);
