document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const ecranMenu = document.getElementById('menu-principal');
    const ecranConfig = document.getElementById('configuration');
    const ecranJeu = document.getElementById('jeu');
    const ecranGameOver = document.getElementById('game-over');
    const btnConfigurer = document.getElementById('btn-configurer');
    const btnAnnuler = document.getElementById('btn-annuler');
    const btnCommencer = document.getElementById('btn-commencer');
    const btnRejouer = document.getElementById('btn-rejouer');
    const btnMenu = document.getElementById('btn-menu');
    const listeMots = document.getElementById('liste-mots');
    const motAllemand = document.getElementById('mot-allemand');
    const scoreElement = document.getElementById('score');
    const scoreFinal = document.getElementById('score-final');
    const canvas = document.getElementById('canvas-jeu');
    const ctx = canvas.getContext('2d');
    const espacementObstacles = document.getElementById('espacement-obstacles');
    const valeurEspacement = document.getElementById('valeur-espacement');
    const directionAllemandFrancais = document.getElementById('direction-allemand-francais');
    const directionFrancaisAllemand = document.getElementById('direction-francais-allemand');

    // Variables du jeu
    let vocabulaire = [];
    let motActuel = '';
    let traductionActuelle = '';
    let score = 0;
    let isGameOver = false;
    let obstacleInterval = null;
    let animationId = null;
    let lastTimestamp = 0;
    let deltaTime = 0;
    let personnageImageLoaded = false;
    let recognition = null;
    let isListening = false;
    let activeObstacle = null;
    let reponseCorrecteDonnee = false;
    let motChangeEnAttente = false;
    let espacementActuel = 600; // Valeur par défaut
    let jeuDeFrancaisVersAllemand = false; // Direction du jeu, par défaut: allemand→français
    let jeuActif = false; // Contrôle si le jeu est en cours

    // Initialisation de la reconnaissance vocale
    function initReconnaissanceVocale() {
        // Vérifier la compatibilité du navigateur
        if (!('webkitSpeechRecognition' in window)) {
            alert("Votre navigateur ne prend pas en charge la reconnaissance vocale. Utilisez Google Chrome ou Microsoft Edge.");
            return false;
        }

        // Créer l'objet de reconnaissance vocale
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        // Langue pour la reconnaissance vocale basée sur la direction du jeu
        recognition.lang = jeuDeFrancaisVersAllemand ? 'de-DE' : 'fr-FR';
        console.log(`Reconnaissance vocale initialisée en ${jeuDeFrancaisVersAllemand ? 'allemand' : 'français'}`);

        // Gérer les résultats de la reconnaissance
        recognition.onresult = function(event) {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                // Utiliser même les résultats intermédiaires
                transcript = event.results[i][0].transcript.trim().toLowerCase();
                console.log(`Reconnaissance: "${transcript}" (confiance: ${event.results[i][0].confidence.toFixed(2)})`);
                
                // Vérifier si la réponse est correcte avec tolérance
                if (estReponseCorrecte(transcript, traductionActuelle)) {
                    console.log("Réponse correcte !");
                    
                    // Marquer directement l'obstacle actif
                    const obstacleActif = obstacles.find(obs => obs.x + obs.width > personnage.x);
                    if (obstacleActif) {
                        obstacleActif.toRemove = true;
                        // Gagner un point immédiatement
                        score++;
                        scoreElement.textContent = `Score: ${score}`;
                        // Préparer le changement de mot pour le prochain obstacle
                        motChangeEnAttente = true;
                    }
                    
                    // Feedback visuel
                    afficherFeedback(true);
                    
                    // Redémarrer la reconnaissance après une réponse correcte
                    setTimeout(() => {
                        redemarrerReconnaissance();
                    }, 500);
                    
                    break; // Sortir de la boucle quand on a trouvé la bonne réponse
                }
            }
        };

        // Redémarrer la reconnaissance plus fréquemment
        recognition.onspeechend = function() {
            console.log("Fin de parole détectée, redémarrage de la reconnaissance...");
            redemarrerReconnaissance();
        };

        // Gérer les erreurs
        recognition.onerror = function(event) {
            console.error("Erreur de reconnaissance vocale: ", event.error);
            if (event.error === 'not-allowed') {
                alert("La reconnaissance vocale nécessite l'autorisation du microphone.");
            }
            redemarrerReconnaissance();
        };

        // Redémarrer la reconnaissance
        recognition.onend = function() {
            console.log("Reconnaissance vocale terminée. Redémarrage...");
            if (isListening && !isGameOver) {
                recognition.start();
            }
        };

        return true;
    }

    // Démarrer l'écoute
    function demarrerEcoute() {
        if (recognition && !isListening) {
            try {
                // Configurer pour une session plus longue
                recognition.maxAlternatives = 3; // Obtenir plusieurs alternatives
                recognition.continuous = true;   // Mode continu
                recognition.interimResults = true; // Résultats intermédiaires
                
                recognition.start();
                isListening = true;
                console.log("Reconnaissance vocale démarrée");
            } catch (e) {
                console.error("Erreur au démarrage de la reconnaissance: ", e);
            }
        }
    }

    // Arrêter l'écoute
    function arreterEcoute() {
        if (recognition && isListening) {
            recognition.stop();
            isListening = false;
            console.log("Reconnaissance vocale arrêtée");
        }
    }

    // Redémarrer la reconnaissance
    function redemarrerReconnaissance() {
        arreterEcoute();
        setTimeout(() => {
            if (!isGameOver) {
                demarrerEcoute();
            }
        }, 300);
    }

    // Afficher un feedback visuel pour la réponse
    function afficherFeedback(estCorrect) {
        const feedback = document.createElement('div');
        feedback.className = `feedback ${estCorrect ? 'correct' : 'incorrect'}`;
        feedback.textContent = estCorrect ? '✓' : '✗';
        ecranJeu.appendChild(feedback);

        // Animer et supprimer après l'animation
        setTimeout(() => {
            feedback.classList.add('fade-out');
            setTimeout(() => {
                feedback.remove();
            }, 500);
        }, 500);
    }

    // Configuration du canvas
    function resizeCanvas() {
        const clientWidth = canvas.clientWidth;
        const clientHeight = canvas.clientHeight;
        if (clientWidth === 0 || clientHeight === 0) {
            console.error("ERREUR: Canvas dimensions nulles avant redimensionnement!");
            // Forcer des dimensions minimales si clientWidth/clientHeight sont nuls
            canvas.width = clientWidth || 800;
            canvas.height = clientHeight || 400;
        } else {
            canvas.width = clientWidth;
            canvas.height = clientHeight;
        }
        console.log(`Canvas redimensionné: ${canvas.width}x${canvas.height}`);
    }

    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOM chargé, initialisation du canvas...");
        resizeCanvas();
    });

    // Classes pour le jeu
    class Personnage {
        constructor() {
            this.width = 50;
            this.height = 70;
            this.x = canvas.width * 0.05;
            this.y = canvas.height - this.height - 10;
            this.vy = 0;
            this.gravity = 1500;
            this.jumpForce = -700;
            this.isJumping = false;
            
            // Image du personnage
            this.img = new Image();
            this.img.onload = () => {
                personnageImageLoaded = true;
            };
            this.img.onerror = () => {
                console.error("Erreur de chargement de l'image du personnage");
                personnageImageLoaded = false;
            };
            this.img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCA3MCI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHJ4PSIxNSIgZmlsbD0iIzMwNzBmZiIvPjxyZWN0IHg9IjE1IiB5PSI0MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjMzA3MGZmIi8+PHJlY3QgeD0iNSIgeT0iNTAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI1IiBmaWxsPSIjMzA3MGZmIi8+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMyIgZmlsbD0id2hpdGUiLz48Y2lyY2xlIGN4PSIzMCIgY3k9IjIwIiByPSIzIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik0yMCAyOCBRIDI1IDM1IDMwIDI4IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=';
        }

        jump() {
            if (!this.isJumping) {
                this.vy = this.jumpForce;
                this.isJumping = true;
            }
        }

        update(deltaTime) {
            // Appliquer la gravité
            this.vy += this.gravity * deltaTime;
            this.y += this.vy * deltaTime;

            // Collision avec le sol
            if (this.y > canvas.height - this.height - 10) {
                this.y = canvas.height - this.height - 10;
                this.vy = 0;
                this.isJumping = false;
            }
        }

        draw() {
            if (personnageImageLoaded) {
                ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
            } else {
                // Forme de secours si l'image ne se charge pas
                ctx.fillStyle = '#3070ff';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = 'white';
                ctx.fillRect(this.x + 10, this.y + 10, 10, 10); // œil gauche
                ctx.fillRect(this.x + 30, this.y + 10, 10, 10); // œil droit
            }
        }

        collidesWith(obstacle) {
            return (
                this.x < obstacle.x + obstacle.width &&
                this.x + this.width > obstacle.x &&
                this.y < obstacle.y + obstacle.height &&
                this.y + this.height > obstacle.y
            );
        }
    }

    class Obstacle {
        constructor() {
            this.width = 30;
            this.height = 50;
            this.x = canvas.width;
            this.y = canvas.height - this.height - 10;
            this.speed = 150;
            this.passed = false;
            this.toRemove = false; // Nouvelle propriété pour marquer l'obstacle à supprimer
        }

        update(deltaTime) {
            this.x -= this.speed * deltaTime;
        }

        draw() {
            // Si l'obstacle est marqué pour suppression, commencer une animation de disparition
            if (this.toRemove) {
                ctx.globalAlpha = 0.5; // Semi-transparent pour montrer qu'il disparaît
                ctx.fillStyle = '#4CAF50'; // Vert pour indiquer succès
            } else {
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#f44336'; // Rouge normal
            }
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.globalAlpha = 1; // Réinitialiser l'opacité
        }

        isOffScreen() {
            return this.x + this.width < 0;
        }
    }

    // Gestion du jeu
    let personnage = new Personnage();
    let obstacles = [];
    
    function genererNouvelObstacle() {
        // S'assurer qu'il y a assez d'espace entre les obstacles
        const lastObstacle = obstacles[obstacles.length - 1];
        if (!lastObstacle || lastObstacle.x < canvas.width - 250) {
            const nouvelObstacle = new Obstacle();
            obstacles.push(nouvelObstacle);
            console.log("Nouvel obstacle généré à x:", nouvelObstacle.x);
        }
    }

    function afficherNouveauMot() {
        if (vocabulaire.length === 0) {
            console.warn("Aucun mot chargé pour afficher.");
            motAllemand.textContent = "-";
            motActuel = ''
            traductionActuelle = '';
            return;
        }
        const index = Math.floor(Math.random() * vocabulaire.length);
        
        // Sélectionner le mot à afficher et la traduction attendue selon la direction du jeu
        if (jeuDeFrancaisVersAllemand) {
            // Mode français->allemand
            motActuel = vocabulaire[index].francais;
            traductionActuelle = vocabulaire[index].allemand;
        } else {
            // Mode allemand->français (par défaut)
            motActuel = vocabulaire[index].allemand;
            traductionActuelle = vocabulaire[index].francais;
        }
        
        motAllemand.textContent = motActuel;
        reponseCorrecteDonnee = false;
        motChangeEnAttente = false;
        console.log(`Nouveau mot: ${motActuel} → ${traductionActuelle}`);
    }

    function miseAJourJeu(deltaTime) {
        // Ne rien faire si le jeu n'est pas actif
        if (!jeuActif) return;
        
        // Nettoyer le canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Vérifier les dimensions du canvas
        if (canvas.width === 0 || canvas.height === 0) {
            console.error("ERREUR: Canvas dimensions nulles dans miseAJourJeu!");
            resizeCanvas(); // Tenter de corriger
            return; // Ne pas continuer si les dimensions sont invalides
        }
        
        // FOND DE COULEUR VISIBLE
        ctx.fillStyle = '#e0f7fa'; // Couleur de fond claire pour voir si le canvas fonctionne
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dessiner le sol
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

        // Mettre à jour et dessiner le personnage
        personnage.update(deltaTime);
        personnage.draw();
        
        // Trouver l'obstacle actif (le plus proche du personnage)
        const obstacleActif = obstacles.find(obs => obs.x + obs.width > personnage.x);

        // Générer des obstacles si nécessaire
        if (obstacles.length === 0 || 
            (obstacles.length < 2 && obstacles[obstacles.length - 1].x < canvas.width - espacementActuel)) {
            const nouvelObstacle = new Obstacle();
            obstacles.push(nouvelObstacle);
            console.log(`Nouvel obstacle généré à ${nouvelObstacle.x}, espacement: ${espacementActuel}`);
        }

        // Traiter chaque obstacle
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
            
            // Mettre à jour la position
            obstacle.update(deltaTime);
            
            // Dessiner l'obstacle
            obstacle.draw();

            // Supprimer les obstacles marqués pour suppression
            if (obstacle.toRemove) {
                obstacles.splice(i, 1);
                
                // Si le mot devait changer, le changer maintenant
                if (motChangeEnAttente) {
                    afficherNouveauMot();
                    motChangeEnAttente = false;
                }
                continue; // Passer au prochain obstacle
            }

            // La partie avec la réponse correcte et le saut est supprimée, car maintenant l'obstacle disparaît directement

            // Vérifier si l'obstacle est passé sans avoir été supprimé
            if (!obstacle.passed && obstacle.x + obstacle.width < personnage.x) {
                obstacle.passed = true;
                console.log("Obstacle passé sans avoir été supprimé!");
                // Remettre le même mot pour la prochaine fois
                motChangeEnAttente = false;
            }
            
            // Supprimer l'obstacle s'il est sorti de l'écran
            if (obstacle.isOffScreen()) {
                obstacles.splice(i, 1);
            }
            
            // Vérifier la collision
            if (personnage.collidesWith(obstacle)) {
                console.log(`COLLISION - Personnage: (${personnage.x}, ${personnage.y}) / Obstacle: (${obstacle.x}, ${obstacle.y})`);
                gameOver();
                return;
            }
        }
    }

    function gameLoop(timestamp) {
        if (isGameOver) return;

        // Calculer deltaTime
        if (!lastTimestamp) lastTimestamp = timestamp;
        deltaTime = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        // Limiter deltaTime pour éviter les problèmes
        if (deltaTime > 0.1) deltaTime = 0.1;

        // Mise à jour du jeu
        miseAJourJeu(deltaTime);

        // Continuer la boucle
        animationId = requestAnimationFrame(gameLoop);
    }

    function chargerVocabulaire() {
        vocabulaire = [];
        const texte = listeMots.value.trim();
        
        if (texte) {
            const lignes = texte.split('\n');
            console.log(`Analyse de ${lignes.length} lignes de vocabulaire`);
            
            for (const ligne of lignes) {
                let allemand = '';
                let francais = '';
                
                // Détecter le format (tabulation ou signe égal)
                if (ligne.includes('\t')) {
                    // Format Excel avec tabulation
                    [allemand, francais] = ligne.split('\t').map(item => item.trim());
                    console.log("Format détecté: tabulation");
                } else if (ligne.includes('=')) {
                    // Format avec signe égal
                    [allemand, francais] = ligne.split('=').map(item => item.trim());
                    console.log("Format détecté: signe égal");
                } else if (ligne.includes(',')) {
                    // Format avec virgule (autre possibilité)
                    [allemand, francais] = ligne.split(',').map(item => item.trim());
                    console.log("Format détecté: virgule");
                } else if (ligne.includes(';')) {
                    // Format avec point-virgule (CSV)
                    [allemand, francais] = ligne.split(';').map(item => item.trim());
                    console.log("Format détecté: point-virgule");
                }
                
                // Vérifier qu'on a bien un mot allemand et sa traduction
                if (allemand && francais) {
                    vocabulaire.push({ allemand, francais });
                    console.log(`Ajouté: ${allemand} = ${francais}`);
                } else if (ligne.trim()) {
                    console.warn(`Ligne ignorée - format non reconnu: "${ligne}"`);
                }
            }
        }
        
        // Si aucun mot n'est entré, afficher un message et ajouter des exemples dans le champ
        if (vocabulaire.length === 0) {
            alert("Merci d'entrer au moins un mot de vocabulaire pour jouer! Vous pouvez coller directement des données d'Excel (allemand + tabulation + français).");
            
            // Proposer des exemples dans le champ de texte s'il est vide
            if (!texte) {
                listeMots.value = `Haus = maison
Auto = voiture
Katze = chat
Hund = chien
Schule = école`;
                listeMots.placeholder = "Copiez-collez depuis Excel ou saisissez: mot allemand = traduction française";
            }
            
            // Interrompre le démarrage du jeu
            ecranJeu.style.display = 'none';
            ecranConfig.style.display = 'block';
            return false;
        }
        
        return true;
    }

    function demarrerJeu() {
        console.log("Initialisation du jeu...");
        
        // Récupérer la valeur du curseur d'espacement
        espacementActuel = parseInt(espacementObstacles.value);
        console.log(`Espacement des obstacles: ${espacementActuel}px`);
        
        // Déterminer la direction du jeu
        jeuDeFrancaisVersAllemand = directionFrancaisAllemand.checked;
        console.log(`Direction du jeu: ${jeuDeFrancaisVersAllemand ? 'Français → Allemand' : 'Allemand → Français'}`);
        
        // Vérifier le vocabulaire
        if (!chargerVocabulaire()) {
            console.warn("Aucun vocabulaire disponible. Annulation du démarrage.");
            ecranConfig.style.display = 'block';
            ecranJeu.style.display = 'none';
            return;
        }
        
        // Réinitialiser l'état du jeu
        isGameOver = false;
        jeuActif = false; // Le jeu n'est pas immédiatement actif
        score = 0;
        scoreElement.textContent = `Score: ${score}`;
        obstacles = []; // Réinitialiser les obstacles
        reponseCorrecteDonnee = false; // Réinitialiser
        motChangeEnAttente = false; // Réinitialiser
        
        // Afficher les écrans
        ecranConfig.style.display = 'none';
        ecranGameOver.style.display = 'none';
        ecranJeu.style.display = 'block';

        // IMPORTANT: S'assurer que le canvas est visible
        canvas.style.display = 'block';
        
        // Dimensionner le canvas après avoir rendu les écrans visibles
        setTimeout(() => {
            resizeCanvas();
            console.log(`Canvas après délai: ${canvas.width}x${canvas.height}`);
            
            // Initialiser le personnage APRÈS avoir dimensionné le canvas
            personnage = new Personnage();
            console.log(`Personnage créé à (${personnage.x}, ${personnage.y})`);
            
            // Afficher le premier mot
            afficherNouveauMot();

            // Initialiser et démarrer la reconnaissance vocale
            if (!recognition) {
                if (initReconnaissanceVocale()) {
                    console.log("Reconnaissance vocale initialisée avec succès.");
                } else {
                    console.warn("Échec de l'initialisation de la reconnaissance vocale.");
                }
            } else {
                // Mettre à jour la langue de la reconnaissance selon la direction du jeu
                recognition.lang = jeuDeFrancaisVersAllemand ? 'de-DE' : 'fr-FR'; 
                console.log(`Langue de reconnaissance définie sur: ${recognition.lang}`);
            }
            
            // Démarrer l'écoute après un court délai
            setTimeout(() => {
                demarrerEcoute();
                console.log("Écoute vocale démarrée.");
            }, 500);
            
            // Démarrer la boucle de jeu
            lastTimestamp = performance.now();
            animationId = requestAnimationFrame(gameLoop);
            
            // Activer le jeu après un court délai pour s'assurer que tout est prêt
            console.log("Démarrage du jeu avec délai de sécurité...");
            setTimeout(() => {
                jeuActif = true;
                console.log("Jeu actif maintenant!");
            }, 1500); // Délai de 1,5 secondes pour s'assurer que tout est prêt
        }, 500);
    }

    function gameOver() {
        console.log("Partie terminée. Score:", score);
        isGameOver = true;
        clearInterval(obstacleInterval);
        cancelAnimationFrame(animationId);
        arreterEcoute(); // Arrêter la reconnaissance vocale
        
        // Afficher l'écran de fin de partie
        ecranJeu.style.display = 'none';
        ecranGameOver.style.display = 'block';
        scoreFinal.textContent = score;
    }

    // Événements
    btnConfigurer.addEventListener('click', () => {
        ecranMenu.style.display = 'none';
        ecranConfig.style.display = 'block';
    });

    btnAnnuler.addEventListener('click', () => {
        ecranConfig.style.display = 'none';
        ecranMenu.style.display = 'block';
    });

    btnCommencer.addEventListener('click', demarrerJeu);

    btnRejouer.addEventListener('click', () => {
        ecranGameOver.style.display = 'none';
        demarrerJeu();
    });

    btnMenu.addEventListener('click', () => {
        ecranGameOver.style.display = 'none';
        ecranMenu.style.display = 'block';
    });

    // Gestion des sauts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !isGameOver) {
            e.preventDefault();
            
            // Au lieu de faire sauter le personnage, faire disparaître l'obstacle actif
            const obstacleActif = obstacles.find(obs => obs.x + obs.width > personnage.x);
            if (obstacleActif) {
                console.log("Obstacle supprimé via espace");
                obstacleActif.toRemove = true;
                
                // Gagner un point
                score++;
                scoreElement.textContent = `Score: ${score}`;
                
                // Préparer le changement de mot
                motChangeEnAttente = true;
            }
        }
    });

    // Mettre à jour l'affichage de la valeur d'espacement
    espacementObstacles.addEventListener('input', () => {
        espacementActuel = parseInt(espacementObstacles.value);
        valeurEspacement.textContent = espacementActuel;
    });

    // Fonction pour vérifier si la réponse est correcte avec tolérance
    function estReponseCorrecte(reponseUtilisateur, reponseAttendue) {
        // Normaliser les deux chaînes
        reponseUtilisateur = reponseUtilisateur.toLowerCase().trim();
        reponseAttendue = reponseAttendue.toLowerCase().trim();
        
        // Vérification exacte
        if (reponseUtilisateur === reponseAttendue) {
            return true;
        }
        
        // Vérification avec articles (le, la, les, un, une, des)
        const articlesFr = ['le ', 'la ', 'les ', 'un ', 'une ', 'des ', 'l\''];
        for (const article of articlesFr) {
            // Si la réponse de l'utilisateur inclut un article mais pas la réponse attendue
            if (reponseUtilisateur.startsWith(article) && reponseUtilisateur.substring(article.length) === reponseAttendue) {
                return true;
            }
            // Si la réponse attendue inclut un article mais pas la réponse de l'utilisateur
            if (reponseAttendue.startsWith(article) && reponseAttendue.substring(article.length) === reponseUtilisateur) {
                return true;
            }
        }
        
        // Tolérance aux fautes légères (distance de Levenshtein)
        if (reponseAttendue.length > 3 && distanceLevenshtein(reponseUtilisateur, reponseAttendue) <= 1) {
            console.log(`Accepté avec tolérance: "${reponseUtilisateur}" pour "${reponseAttendue}"`);
            return true;
        }
        
        return false;
    }
    
    // Calcul de la distance de Levenshtein (tolérance aux fautes d'orthographe légères)
    function distanceLevenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = [];
        
        // Initialiser la matrice
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        // Remplir la matrice
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i-1) === a.charAt(j-1)) {
                    matrix[i][j] = matrix[i-1][j-1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i-1][j-1] + 1, // substitution
                        matrix[i][j-1] + 1,   // insertion
                        matrix[i-1][j] + 1    // suppression
                    );
                }
            }
        }
        
        return matrix[b.length][a.length];
    }
});
