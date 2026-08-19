using UnityEngine;

namespace MeridianPack
{
    /// <summary>
    /// Meridian 엔진의 선택적 확장 동작. 대기 밀도에 따라 ISP 를 보간해
    /// "진공 특화" 컨셉을 수치로도 표현한다.
    ///
    /// 중요:
    ///  - 이 스크립트가 없어도 Meridian 은 완전히 동작한다(고정 ISP 330).
    ///    파트팩은 코드 없이 성립해야 하고, 이 파일은 어디까지나 PC 확장이다.
    ///  - 코드 어셈블리는 모바일(IL2CPP)에서 실행이 보장되지 않는다.
    ///    따라서 이 스크립트가 꺼진 상태를 기본 동작으로 삼는다.
    ///  - 아래 TODO 두 곳은 SFS 버전마다 API 가 다르므로, 실제 게임 DLL 을 dnSpy 등으로 열어
    ///    확인한 뒤 채워야 한다. 확인 전에는 fallbackIsp 로 안전하게 동작한다.
    /// </summary>
    public class MeridianEngineModule : MonoBehaviour
    {
        [Header("연결")]
        [Tooltip("같은 프리팹의 EngineModule 을 인스펙터에서 연결한다.")]
        [SerializeField] private MonoBehaviour engineModule;   // SFS.Parts.Modules.EngineModule

        [Header("ISP 보간")]
        [Tooltip("진공에서의 ISP. parts/meridian.part.json 의 engine.isp 와 같은 값이어야 한다.")]
        [SerializeField] private float vacuumIsp = 330f;

        [Tooltip("해수면(대기 밀도 1.0)에서의 ISP. 진공 엔진이므로 낮게 잡는다.")]
        [SerializeField] private float seaLevelIsp = 250f;

        [Tooltip("대기 밀도를 읽지 못할 때 사용할 값. 안전한 기본값은 진공 ISP 다.")]
        [SerializeField] private float fallbackIsp = 330f;

        [Tooltip("끄면 이 스크립트는 아무것도 하지 않는다(= 순수 파트팩과 동일한 동작).")]
        [SerializeField] private bool enableIspCurve = false;

        private float _lastApplied = float.NaN;

        private void Update()
        {
            if (!enableIspCurve || engineModule == null)
                return;

            float density = GetAtmosphereDensity01();
            float isp = float.IsNaN(density)
                ? fallbackIsp
                : Mathf.Lerp(vacuumIsp, seaLevelIsp, Mathf.Clamp01(density));

            if (!Mathf.Approximately(isp, _lastApplied))
            {
                ApplyIsp(isp);
                _lastApplied = isp;
            }
        }

        /// <summary>
        /// 현재 위치의 대기 밀도를 0(진공)~1(해수면)로 반환한다.
        /// TODO: SFS 의 행성/대기 API 에 연결할 것. 연결 전에는 NaN 을 돌려주어
        /// 호출 측이 fallbackIsp 를 쓰도록 한다.
        /// </summary>
        private float GetAtmosphereDensity01()
        {
            return float.NaN;
        }

        /// <summary>
        /// EngineModule.ISP 에 값을 반영한다.
        /// TODO: ISP 는 Composed_Float 이므로 단순 대입이 아니라 해당 타입의 API 로 써야 한다.
        /// 게임 DLL 에서 Composed_Float 의 값 설정 방식을 확인한 뒤 구현할 것.
        /// </summary>
        private void ApplyIsp(float isp)
        {
            // 구현 전에는 의도적으로 아무것도 하지 않는다 —
            // 잘못 대입하면 엔진이 통째로 죽는 것보다 고정 ISP 로 도는 편이 낫다.
        }
    }
}
