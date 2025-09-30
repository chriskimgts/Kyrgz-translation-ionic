import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { AuthService } from './app/auth.service';
import { ConversationHistoryService } from './app/conversation-history.service';
import { TranslatorService } from './app/services/translator.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideHttpClient(),
    provideRouter(routes),
    AuthService,
    ConversationHistoryService,
    TranslatorService,
  ],
}).catch((err) => console.log(err));
