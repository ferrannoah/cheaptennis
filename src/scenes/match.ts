import { Scene, game, W, H, DT } from '../core/game';
import { Match, MatchConfig } from '../match/match';
import { MatchView, GRADE_COLOR } from '../gfx/match-view';
import { audio } from '../core/audio';
import { input } from '../core/input';
import { settings, saveSettings } from '../core/settings';
import { PauseScene } from './pause';
import { Player } from '../match/player';
import { text } from '../gfx/text';

export interface MatchResult {
  winner: 0 | 1;
  summary: string;
  games: [number, number];
  sets: [number, number];
  perfects: [number, number];
  aces: [number, number];
  longRallyWins: [number, number];
  breakSaved: [number, number];
  quit: boolean;
}

export interface MatchSceneOpts {
  onEnd: (r: MatchResult) => void;
  onQuit?: () => void;
  title?: string;
  /** practice HUD extras */
  practiceOverlay?: (ctx: CanvasRenderingContext2D, m: Match) => void;
  onEvent?: (e: Match['events'][number], m: Match) => void;
  onUpdate?: (m: Match) => void;
}

export class MatchScene implements Scene {
  name = 'match';
  m: Match;
  view: MatchView;
  overT = 0;
  ended = false;
  breathT = 0;

  constructor(public cfg: MatchConfig, public opts: MatchSceneOpts) {
    this.m = new Match(cfg);
    this.view = new MatchView(this.m);
  }

  enter(): void {
    audio.stopSong();
    audio.playSong('intro', false);
    const vs = `${this.m.players[0].setup.name}  vs  ${this.m.players[1].setup.name}`;
    const v = this.view.venue;
    if (this.view.look.introCard && v.round) {
      // walk-on card for the big matches
      this.view.showBanner(`${v.round.toUpperCase()}${v.tier === 'major' || v.tier === 'final' ? '  •  CENTRE COURT' : ''}`, `${v.name ? v.name + '  •  ' : ''}${vs}`, 2.8);
      this.view.burstFlashes(Math.round(10 + 30 * v.stage));
    } else if (this.opts.title) this.view.showBanner(this.opts.title, vs, 2.2);
  }

  label(p: 0 | 1): string {
    return this.m.players[p].setup.short;
  }

  update(): void {
    if (input.menu('pause') && !this.ended) {
      audio.sfx('menu_ok');
      game.push(new PauseScene(this));
      return;
    }
    if (input.keyPressed('KeyM')) audio.toggleMute();
    // H: show/hide the fatigue details (unless H is a shot key for someone in this match, e.g. keyboard versus)
    if (input.keyPressed('KeyH') && !this.m.players.some((p) => p.ctrl?.profile && Object.values(settings.keys[p.ctrl.profile]).some((ks) => ks.includes('KeyH')))) {
      settings.fatigueInfo = !settings.fatigueInfo;
      saveSettings();
      audio.sfx('menu_move');
    }
    const m = this.m;
    const hs = m.hitstop;
    const skips = m.skips;
    m.update();
    if (hs === 0) this.view.update(DT);
    this.handleEvents();
    if (m.skips !== skips) {
      // a skip between points also clears the point's popups, umpire call and banners
      this.view.call = null;
      this.view.popups = [];
      this.view.banner = null;
    }
    this.opts.onUpdate?.(m);
    if (m.phase === 'over') {
      this.overT++;
      if (this.overT > 240 && !this.ended) {
        this.ended = true;
        this.opts.onEnd(this.result(false));
      }
    }
    // heavy breathing between points when tired
    if ((m.phase === 'serve' || m.phase === 'dead') && m.players.some((p) => p.human && p.staminaF() < 0.35)) {
      this.breathT++;
      if (this.breathT % 70 === 1) audio.sfx('breath', 0.8);
    }
  }

  result(quit: boolean): MatchResult {
    const m = this.m;
    const pp = <K extends keyof Player>(k: K) => [m.players[0][k], m.players[1][k]] as [Player[K], Player[K]];
    return {
      winner: (m.score.winner < 0 ? 1 : m.score.winner) as 0 | 1,
      summary: m.score.summary(),
      games: [...m.score.games] as [number, number],
      sets: [...m.score.sets] as [number, number],
      perfects: pp('perfects') as [number, number],
      aces: pp('aces') as [number, number],
      longRallyWins: pp('longRallyWins') as [number, number],
      breakSaved: [...m.score.breakPointsSaved] as [number, number],
      quit,
    };
  }

  private handleEvents(): void {
    const m = this.m;
    const v = this.view;
    const sfId = m.sf.id;
    for (const e of m.events) {
      this.opts.onEvent?.(e, m);
      switch (e.t) {
        case 'hit': {
          const p = m.players[e.p];
          const pan = (p.x / 8) * 0.6;
          if (e.volley) audio.sfx('volley', 1, 1, pan);
          else audio.sfx(e.grade === 'PERFECT' ? 'hit_perfect' : e.grade === 'GOOD' ? 'hit_good' : e.grade === 'MISHIT' ? 'hit_mishit' : 'hit_weak', 1, 0.97 + Math.random() * 0.06, pan);
          if (e.grade === 'PERFECT') {
            audio.sfx('perfect', 0.9);
            if (!settings.reducedShake) game.shake = 3;
            v.particles.spawn('spark', m.ball.x, m.ball.y, m.ball.z, 10, '#fff6a0', 1);
            v.flashRing(m.ball.x, m.ball.y, m.ball.z);
          }
          const human = p.human || m.cfg.controllers.every((c) => c === null);
          const label = e.grade === 'PERFECT' ? 'PERFECT!' : e.grade;
          let sub = e.reason;
          if (e.grade === 'GOOD' && e.reason === 'clean contact') sub = e.volley ? 'volley' : '';
          v.popup(p, label, human ? sub : '', GRADE_COLOR[e.grade], human);
          if (e.dive) v.particles.spawn(sfId === 'clay' ? 'dust' : 'grass', p.x, p.y, 0.1, 6, sfId === 'clay' ? '#e0a07a' : '#7ccf5a', 1);
          break;
        }
        case 'whiff': {
          const p = m.players[e.p];
          audio.sfx('whiff', 0.8);
          if (p.human) v.popup(p, 'MISS', e.reason, GRADE_COLOR.MISS, true);
          break;
        }
        case 'toss':
          audio.sfx('toss', 0.7);
          break;
        case 'serve': {
          const p = m.players[e.p];
          v.lastServeKmh = e.kmh;
          audio.sfx(e.grade === 'PERFECT' ? 'hit_perfect' : 'hit_good', 1);
          if (e.grade === 'PERFECT') audio.sfx('perfect', 0.7);
          const typeLabel = e.type === 'flat' ? '' : e.type === 'kick' ? 'KICK ' : 'SLICE ';
          const tag = e.grade === 'PERFECT' ? 'PERFECT' : e.grade === 'GOOD' ? 'GOOD' : e.grade;
          v.popup(p, `${typeLabel}${Math.round(e.kmh)} km/h`, p.human ? `${tag} toss timing` : '', GRADE_COLOR[e.grade], p.human);
          break;
        }
        case 'bounce': {
          audio.sfx('bounce_' + sfId, Math.min(1, 0.4 + e.speed / 25), 0.96 + Math.random() * 0.08);
          if (sfId === 'clay') {
            v.particles.spawn('dust', e.x, e.y, 0.05, 4, '#e8a882', 0.6);
            v.stampWear(e.x, e.y, 0.12, 0.25);
          } else if (sfId === 'grass') {
            v.particles.spawn('grass', e.x, e.y, 0.03, 3, '#7ccf5a', 0.6);
            v.stampWear(e.x, e.y, 0.1, 0.12);
          } else v.particles.spawn('spark', e.x, e.y, 0.03, 2, '#ffffff', 0.4);
          break;
        }
        case 'net':
          audio.sfx('net_thud');
          break;
        case 'netcord':
          audio.sfx('net_cord');
          break;
        case 'call':
          if (e.kind === 'fault') audio.sfx('fault');
          else if (e.kind === 'out' || e.kind === 'net') audio.sfx('out');
          else audio.sfx('ump');
          v.showCall(e.text, e.kind === 'fault' || e.kind === 'out' || e.kind === 'net' ? '#ffb0a0' : e.kind === 'let' ? '#bfe3ff' : '#ffffff');
          break;
        case 'point': {
          const big = e.rally >= 8 || e.how === 'ace' || e.how === 'winner';
          audio.sfx(big ? 'applause_big' : 'applause_small', Math.min(1, (big ? 0.85 : 0.55) * v.look.noise));
          if (e.how === 'out' && Math.abs(Math.abs(m.rally.bounceX) - 4.115) < 0.4) audio.sfx('ooh', 0.8);
          break;
        }
        case 'score':
          this.announce(e.events, e.winner);
          break;
        case 'changeover': {
          const sc = m.score;
          v.showBanner(e.set ? 'SET BREAK' : 'CHANGEOVER', `Games ${sc.games[0]}-${sc.games[1]}${sc.isGamesFormat ? '' : `   Sets ${sc.sets[0]}-${sc.sets[1]}`}  •  stamina recovering`, 2);
          break;
        }
        case 'over': {
          const w = m.players[e.winner];
          v.showBanner('GAME, SET AND MATCH', `${w.setup.name} wins  ${m.score.summary()}`, 4);
          const humanWon = w.human;
          const anyHuman = m.players.some((p) => p.human);
          audio.playSong(!anyHuman || humanWon || m.players.every((p) => p.human) ? 'victory' : 'defeat', false);
          audio.sfx('applause_big', 1);
          m.crowdExcite = 1;
          // the whole stadium lights up with camera flashes after match point in a final
          v.burstFlashes(v.venue.stage >= 0.99 ? 90 : Math.round(20 * v.look.flashes));
          break;
        }
        case 'step':
          if (e.slide) {
            audio.sfx('skid', 0.6);
            const p = m.players[e.p];
            v.particles.spawn('dust', p.x, p.y, 0.05, 6, '#e0a07a', 0.8);
          } else audio.sfx('step', 0.5, 0.9 + Math.random() * 0.2);
          break;
        case 'feed':
          audio.sfx('hit_weak', 0.6);
          break;
        case 'plan':
          v.planTag[e.p] = { tactic: e.tactic, t: 0 };
          break;
        case 'adapt':
          // the COM's tactics are hidden during play
          break;
      }
    }
    m.events.length = 0;
  }

  private announce(evs: string[], winner: 0 | 1): void {
    const v = this.view;
    const m = this.m;
    const L = this.label(winner);
    if (evs.includes('match')) return;
    if (evs.includes('set')) {
      v.showCall(`SET ${L}`, '#ffd479');
      audio.playSong('sting_game', false);
    } else if (evs.includes('game')) {
      v.showCall(evs.includes('break') ? `BREAK! GAME ${L}` : `GAME ${L}`, '#ffd479');
      audio.playSong('sting_game', false);
    } else if (evs.includes('deuce')) v.showCall('DEUCE');
    else if (evs.includes('advantage')) {
      const lead = m.score.points[0] > m.score.points[1] ? 0 : 1;
      v.showCall(`ADVANTAGE ${this.label(lead as 0 | 1)}`);
    }
    if (evs.includes('tiebreak')) v.showBanner('TIEBREAK', 'First to 7, win by 2', 1.8);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.view.draw(ctx, { hud: true, training: settings.trainingHud || !!this.m.practice });
    this.opts.practiceOverlay?.(ctx, this.m);
    if (this.m.canSkipDowntime) text(ctx, 'SPACE  skip', W - 14, H - 14, { size: 10, align: 'right', color: '#d6e4f7', outline: '#13284a', weight: 700 });
    if (settings.showFps) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(`${game.fps.toFixed(0)} fps  parts ${this.view.particles.list.length}`, W - 120, H - 6);
    }
  }

  debugState(): Record<string, unknown> {
    return { ...this.m.debug(), popups: this.view.popups.map((p) => p.text + '|' + p.sub), call: this.view.call?.text ?? null, banner: this.view.banner?.text ?? null, particles: this.view.particles.list.length };
  }
}
