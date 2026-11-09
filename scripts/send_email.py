#!/usr/bin/env python3
"""알림 이메일 발송 도우미 (GitHub Actions 전용, 표준 라이브러리만 사용).

텔레그램 알림 스크립트(notify_missing_records.py, quality-scheduler-alert.cjs)가 같은
내용을 메일로도 보내려고 쓴다. 발송 계정·수신자는 코드에 두지 않고 GitHub Secrets 에서
환경변수로만 받는다(저장소 소스·배포 사이트에 이메일 주소·이름이 남지 않게).

환경변수
  SMTP_USER      발송 Gmail 주소
  SMTP_PASSWORD  Gmail 앱 비밀번호(16자리)
  MAIL_TO        수신자(쉼표·공백·세미콜론 구분) — 선택. 시스템 설정 화면에서 등록한 수신자와 합쳐 쓴다
  SMTP_HOST/PORT 선택 — 기본 smtp.gmail.com / 465(SSL)
SMTP_USER/SMTP_PASSWORD 가 없거나 수신자가 한 명도 없으면 이메일은 건너뛴다(오류 아님).
수신자는 MAIL_TO + 시스템 설정 화면 등록분(--to)을 합쳐 중복 없이 쓴다.

CLI: python3 scripts/send_email.py --subject "제목" [--to a@x,b@y] < 본문(텔레그램 HTML 가능)
"""
from __future__ import annotations

import argparse
import html
import os
import re
import smtplib
import sys
from email.message import EmailMessage
from email.utils import formataddr


def html_to_text(text: str) -> str:
    """텔레그램용 HTML(<b>·<a> 등)을 메일 본문용 평문으로."""
    text = re.sub(r'<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r'\2 (\1)', text, flags=re.S)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</?[a-zA-Z][^>]*>', '', text)
    return html.unescape(text).strip()


def recipients(extra: list[str] | None = None) -> list[str]:
    """MAIL_TO(Secrets) + extra(시스템 설정 등록분)를 합쳐 중복 없이."""
    raw = os.environ.get('MAIL_TO', '') + ',' + ','.join(extra or [])
    seen: list[str] = []
    for r in re.split(r'[\s,;]+', raw):
        if r and '@' in r and r.lower() not in [x.lower() for x in seen]:
            seen.append(r)
    return seen


def configured(extra: list[str] | None = None) -> bool:
    return bool(os.environ.get('SMTP_USER') and os.environ.get('SMTP_PASSWORD') and recipients(extra))


def send_mail(subject: str, body: str, dry_run: bool = False, extra_to: list[str] | None = None) -> bool:
    """메일 1통 발송. 설정이 없으면 False(건너뜀), 실패하면 예외."""
    if not configured(extra_to):
        print('이메일 설정(SMTP_USER/SMTP_PASSWORD, 수신자)이 없어 메일은 보내지 않습니다.')
        return False
    plain = html_to_text(body)
    if dry_run:
        print(f'[dry-run] 이메일 제목: {subject}\n{plain}\n')
        return True
    user = os.environ['SMTP_USER'].strip()
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = formataddr(('동김제농협 스마트 HACCP', user))
    to_list = recipients(extra_to)
    msg['To'] = ', '.join(to_list)
    msg.set_content(plain)
    host = os.environ.get('SMTP_HOST') or 'smtp.gmail.com'
    port = int(os.environ.get('SMTP_PORT') or 465)
    with smtplib.SMTP_SSL(host, port, timeout=30) as smtp:
        smtp.login(user, os.environ['SMTP_PASSWORD'].strip())
        smtp.send_message(msg)
    print(f'이메일 발송 완료 ({len(to_list)}명)')
    return True


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--subject', required=True)
    ap.add_argument('--to', default='', help='추가 수신자(쉼표 구분)')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    try:
        send_mail(args.subject, sys.stdin.read(), dry_run=args.dry_run,
                  extra_to=[x for x in re.split(r'[\s,;]+', args.to) if x])
    except Exception as e:  # 메일 실패가 텔레그램 알림 결과를 깨뜨리지 않게 종료코드만 알린다
        print(f'이메일 발송 실패: {e}', file=sys.stderr)
        sys.exit(1)
