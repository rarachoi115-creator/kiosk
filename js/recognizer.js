/**
 * 카메라 제어, Teachable Machine 모델 불러오기, 반복 예측을 담당하는 공용 모듈입니다.
 * 다른 화면에서도 createRecognizer(옵션)를 호출해 그대로 다시 사용할 수 있습니다.
 */
(function (global) {
  "use strict";

  /**
   * 모델 폴더 경로 끝에 항상 슬래시(/)가 붙도록 정리합니다.
   * @param {string} path
   * @returns {string}
   */
  function normalizeFolderPath(path) {
    if (!path) {
      return "./model/";
    }
    return path.endsWith("/") ? path : path + "/";
  }

  /**
   * 모델 불러오기 또는 카메라 실행 중 발생한 오류를
   * 초보자도 이해할 수 있는 한국어 이유와 해결 방법으로 바꿉니다.
   * @param {Error} error
   * @param {"model"|"camera"} stage
   * @returns {{ reason: string, solution: string, rawError: Error }}
   */
  function formatErrorInKorean(error, stage) {
    const errorName = error && error.name ? error.name : "";

    if (stage === "model") {
      return {
        reason: "AI 모델 파일이나 인식 라이브러리를 불러오지 못했습니다.",
        solution:
          "model 폴더 안에 model.json, metadata.json, weights.bin 파일이 있는지 확인하고, 로컬 서버(http://localhost:3000)와 인터넷 연결 상태를 확인한 뒤 새로고침해 주세요.",
        rawError: error
      };
    }

    // 카메라가 없는 환경이나 보안 컨텍스트 문제 처리
    if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
      return {
        reason: "카메라 사용 권한이 거부되었습니다.",
        solution:
          "브라우저 주소창 옆의 카메라(또는 자물쇠) 아이콘에서 카메라 권한을 '허용'으로 바꾼 뒤 새로고침해 주세요.",
        rawError: error
      };
    }

    if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
      return {
        reason: "연결된 카메라를 찾을 수 없습니다.",
        solution:
          "노트북 카메라 또는 외장 웹캠이 제대로 연결되어 있는지 확인한 뒤 다시 시도해 주세요.",
        rawError: error
      };
    }

    if (errorName === "NotReadableError" || errorName === "TrackStartError") {
      return {
        reason: "다른 프로그램이나 브라우저 탭에서 카메라를 이미 사용 중입니다.",
        solution:
          "카메라를 사용 중인 다른 앱이나 탭을 닫은 뒤 '다시 시도'를 눌러 주세요.",
        rawError: error
      };
    }

    if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") {
      return {
        reason: "요청한 카메라 설정을 현재 기기에서 사용할 수 없습니다.",
        solution:
          "기기의 카메라 연결 상태를 확인하고 페이지를 새로고침해 주세요.",
        rawError: error
      };
    }

    if (errorName === "SecurityError" || !global.isSecureContext) {
      return {
        reason: "보안되지 않은 주소에서는 브라우저가 카메라 접근을 허용하지 않습니다.",
        solution:
          "http://localhost:3000 또는 https:// 로 시작하는 주소로 접속해 주세요.",
        rawError: error
      };
    }

    return {
      reason: "카메라를 켜는 중 알 수 없는 문제가 발생했습니다.",
      solution:
        "브라우저의 카메라 권한과 연결 상태를 확인한 뒤 새로고침하거나 Chrome 브라우저로 접속해 주세요.",
      rawError: error
    };
  }

  /**
   * 인식기 인스턴스를 생성합니다.
   * @param {Object} options
   * @param {HTMLVideoElement} options.videoElement 카메라 영상을 표시할 video 요소
   * @param {string} [options.modelPath="./model/"] 모델 폴더 경로
   * @param {string} [options.facingMode="user"] 카메라 방향 ("user" 또는 "environment")
   * @param {Function} [options.onStatus] 상태 변경 콜백 ({ code, message })
   * @param {Function} [options.onLabelsReady] 클래스 이름 목록 준비 완료 콜백 (labels: string[])
   * @param {Function} [options.onPredict] 예측 결과 전달 콜백 ([{ className, probability }, ...])
   * @param {Function} [options.onError] 오류 전달 콜백 ({ reason, solution, rawError })
   */
  function createRecognizer(options) {
    const config = options || {};
    const videoElement = config.videoElement;
    const modelBasePath = normalizeFolderPath(config.modelPath);
    const facingMode = config.facingMode || "user";

    let model = null;
    let stream = null;
    let rafId = null;
    let isRunning = false;
    let isStopped = false;

    // 영상의 가운데 정사각형 부분만 잘라 모델에 넣기 위한 임시 캔버스
    const cropCanvas = document.createElement("canvas");
    const cropContext = cropCanvas.getContext("2d");

    function notifyStatus(code, message) {
      if (typeof config.onStatus === "function") {
        config.onStatus({ code: code, message: message });
      }
    }

    function notifyError(error, stage) {
      const formatted = formatErrorInKorean(error, stage);
      notifyStatus("error", "실행 오류");
      if (typeof config.onError === "function") {
        config.onError(formatted);
      }
    }

    /**
     * 비디오 프레임에서 가운데 정사각형 영역만 오프스크린 캔버스에 그립니다.
     * Teachable Machine 모델이 정사각형 입력을 기준으로 학습되기 때문입니다.
     * @param {number} targetSize
     * @returns {boolean}
     */
    function drawCenterSquareFrame(targetSize) {
      if (!videoElement || videoElement.readyState < 2) {
        return false;
      }

      const vw = videoElement.videoWidth;
      const vh = videoElement.videoHeight;
      if (!vw || !vh) {
        return false;
      }

      if (cropCanvas.width !== targetSize || cropCanvas.height !== targetSize) {
        cropCanvas.width = targetSize;
        cropCanvas.height = targetSize;
      }

      // 가로·세로 중 더 짧은 변을 기준으로 정중앙 정사각형을 잘라냄
      const minSide = Math.min(vw, vh);
      const startX = (vw - minSide) / 2;
      const startY = (vh - minSide) / 2;

      cropContext.drawImage(
        videoElement,
        startX,
        startY,
        minSide,
        minSide,
        0,
        0,
        targetSize,
        targetSize
      );

      return true;
    }

    /**
     * 앞선 예측이 완전히 끝난 뒤에만 다음 예측을 시작하는 순차 반복 루프입니다.
     */
    async function runPredictionLoop() {
      if (!isRunning || isStopped || !model) {
        return;
      }

      const metadata = typeof model.getMetadata === "function" ? model.getMetadata() : null;
      const inputSize = metadata && metadata.imageSize ? metadata.imageSize : 224;

      if (drawCenterSquareFrame(inputSize)) {
        try {
          // 거울 모드로 학습된 모델에 맞춰 두 번째 인자 flipped 를 true 로 전달
          const rawPredictions = await model.predict(cropCanvas, true);

          if (!isRunning || isStopped) {
            return;
          }

          const results = rawPredictions.map(function (item) {
            return {
              className: item.className,
              probability: item.probability
            };
          });

          if (typeof config.onPredict === "function") {
            config.onPredict(results);
          }
        } catch (err) {
          console.error("예측 실행 중 오류:", err);
        }
      }

      // 현재 예측이 끝난 뒤 다음 화면 갱신 시점에 다음 예측 예약
      if (isRunning && !isStopped) {
        rafId = global.requestAnimationFrame(runPredictionLoop);
      }
    }

    /**
     * 카메라 스트림을 열고 video 요소에 연결합니다.
     */
    async function startCamera() {
      if (!videoElement) {
        throw new Error("video 요소가 지정되지 않았습니다.");
      }

      if (!global.navigator || !global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
        const unsupportedError = new Error("getUserMedia 미지원");
        unsupportedError.name = global.isSecureContext ? "NotFoundError" : "SecurityError";
        throw unsupportedError;
      }

      const mediaStream = await global.navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode }
        },
        audio: false
      });

      // 카메라 권한을 기다리는 도중 화면을 떠났다면 즉시 카메라를 끔
      if (isStopped) {
        mediaStream.getTracks().forEach(function (track) {
          track.stop();
        });
        return;
      }

      stream = mediaStream;
      videoElement.srcObject = stream;

      // 영상 크기(videoWidth, videoHeight)가 준비될 때까지 대기
      await new Promise(function (resolve) {
        if (videoElement.readyState >= 1 && videoElement.videoWidth > 0) {
          resolve();
          return;
        }
        function handleReady() {
          videoElement.removeEventListener("loadedmetadata", handleReady);
          resolve();
        }
        videoElement.addEventListener("loadedmetadata", handleReady);
      });

      try {
        await videoElement.play();
      } catch (playErr) {
        console.warn("비디오 자동 재생 대기:", playErr);
      }
    }

    /**
     * 모델 불러오기 -> 카메라 켜기 -> 반복 예측을 순서대로 시작합니다.
     */
    async function start() {
      stop();
      isStopped = false;

      // 1단계: 모델 불러오기
      notifyStatus("loading-model", "모델 불러오는 중...");
      try {
        if (!global.tmImage || typeof global.tmImage.load !== "function") {
          throw new Error("Teachable Machine 이미지 라이브러리를 찾을 수 없습니다.");
        }

        const modelURL = modelBasePath + "model.json";
        const metadataURL = modelBasePath + "metadata.json";
        model = await global.tmImage.load(modelURL, metadataURL);

        if (isStopped) {
          return;
        }

        if (typeof config.onLabelsReady === "function" && typeof model.getClassLabels === "function") {
          config.onLabelsReady(model.getClassLabels());
        }
      } catch (modelErr) {
        console.error("모델 불러오기 오류:", modelErr);
        notifyError(modelErr, "model");
        return;
      }

      // 2단계: 카메라 켜기
      notifyStatus("requesting-camera", "카메라 권한을 허용해 주세요");
      try {
        await startCamera();
        if (isStopped) {
          return;
        }
      } catch (cameraErr) {
        console.error("카메라 시작 오류:", cameraErr);
        notifyError(cameraErr, "camera");
        return;
      }

      // 3단계: 반복 예측 시작
      isRunning = true;
      notifyStatus("running", "인식 중");
      runPredictionLoop();
    }

    /**
     * 예측 반복과 카메라를 즉시 끕니다.
     */
    function stop() {
      isRunning = false;
      isStopped = true;

      if (rafId !== null) {
        global.cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (stream) {
        stream.getTracks().forEach(function (track) {
          track.stop();
        });
        stream = null;
      }

      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    }

    return {
      start: start,
      stop: stop
    };
  }

  // 다른 스크립트에서 호출할 수 있도록 전역에 등록
  global.createRecognizer = createRecognizer;
})(window);
