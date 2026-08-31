import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthNotice } from './auth-notice.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthNoticeService {
  onNoticeChanged$: BehaviorSubject<AuthNotice>;

  constructor() {
    this.onNoticeChanged$ = new BehaviorSubject(null);
  }

  setNotice(message: string, type?: string) {
    const notice: AuthNotice = {
      message,
      type
    };
    this.onNoticeChanged$.next(notice);
  }
}
