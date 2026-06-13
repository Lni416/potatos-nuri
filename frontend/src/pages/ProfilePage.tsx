import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyProfile, updateProfile, UserProfile } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

const REGION_OPTIONS = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "기타"] as const;
const REGION_NAME_MAP: Record<string, string> = {
  서울: "서울특별시", 경기: "경기도", 인천: "인천광역시", 부산: "부산광역시",
  대구: "대구광역시", 광주: "광주광역시", 대전: "대전광역시", 기타: "경기도",
};
const INTEREST_OPTIONS = [
  { value: "생활지원", label: "생활·복지" },
  { value: "의료건강", label: "의료·건강" },
  { value: "주거", label: "주거·임대" },
  { value: "취업고용", label: "취업·일자리" },
  { value: "교육장학", label: "교육·장학" },
  { value: "임신육아", label: "임신·육아" },
  { value: "노인돌봄", label: "노인·돌봄" },
  { value: "문화여가", label: "문화·여가" },
];
const OCCUPATION_OPTIONS = ["학생", "직장인", "자영업자", "은퇴", "기타"];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [age, setAge] = useState(30);
  const [regionCode, setRegionCode] = useState("기타");
  const [occupation, setOccupation] = useState("기타");
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    getMyProfile()
      .then(({ profile }) => {
        if (profile) {
          setAge(profile.age);
          setRegionCode(profile.regionCode);
          setOccupation(profile.occupation);
          setInterests(profile.interests);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleInterest(val: string) {
    setInterests((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const profile: UserProfile = {
        age,
        regionCode,
        regionName: REGION_NAME_MAP[regionCode] ?? "경기도",
        occupation,
        interests,
      };
      await updateProfile(profile);
      setSuccess(true);
      setTimeout(() => navigate("/feed"), 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  if (loading) return <div className="loading-screen"><span className="loading-spinner" /></div>;

  return (
    <div className="profile-page">
      <div className="profile-user">
        {currentUser?.photoURL && (
          <img src={currentUser.photoURL} alt="프로필" className="profile-avatar" width={56} height={56} />
        )}
        <div>
          <p className="profile-name">{currentUser?.displayName ?? "사용자"}</p>
          <p className="profile-email">{currentUser?.email}</p>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSave}>
        <label className="profile-field">
          <span className="profile-label">나이</span>
          <input
            type="number"
            className="profile-input"
            value={age}
            min={1}
            max={120}
            onChange={(e) => setAge(Number(e.target.value))}
          />
        </label>

        <div className="profile-field">
          <span className="profile-label">지역</span>
          <div className="profile-chip-group">
            {REGION_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`profile-chip${regionCode === r ? " selected" : ""}`}
                onClick={() => setRegionCode(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="profile-field">
          <span className="profile-label">직업</span>
          <div className="profile-chip-group">
            {OCCUPATION_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                className={`profile-chip${occupation === o ? " selected" : ""}`}
                onClick={() => setOccupation(o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="profile-field">
          <span className="profile-label">관심 분야</span>
          <div className="profile-chip-group">
            {INTEREST_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`profile-chip${interests.includes(value) ? " selected" : ""}`}
                onClick={() => toggleInterest(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="profile-error" role="alert">{error}</p>}
        {success && <p className="profile-success">저장되었습니다!</p>}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </form>

      <button className="profile-signout" onClick={handleSignOut}>
        로그아웃
      </button>
    </div>
  );
}
