import { NgModule } from '@angular/core';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';

// Import services
import { AuthService } from './auth.service';
import { ConversationHistoryService } from './conversation-history.service';
import { TranslatorService } from './services/translator.service';

@NgModule({
  declarations: [],
  imports: [IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    TranslatorService,
    AuthService,
    ConversationHistoryService,
  ],
})
export class AppModule {}
